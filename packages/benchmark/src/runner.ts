import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { BenchmarkDataset, BenchmarkReport, TaskResult } from './types.js';
import {
  AtlasDatabase,
  runMigrations,
  FileRepository,
  SearchRepository,
  DependencyRepository,
} from '@codeatlas-ai/storage';
import { Indexer } from '@codeatlas-ai/indexer';
import { DependencyGraph } from '@codeatlas-ai/graph';
import { RetrievalEngine } from '@codeatlas-ai/retrieval';
import { Ranker } from '@codeatlas-ai/ranking';
import { ContextEngine } from '@codeatlas-ai/context';
import { RuleEngine } from '@codeatlas-ai/rules';
import { TokenCounter } from '@codeatlas-ai/token-counter';
import type { FileInfo, ProjectMeta } from '@codeatlas-ai/core';

export class BenchmarkRunner {
  private baseDir: string;
  private tokenCounter: TokenCounter;

  constructor(baseDir: string = path.resolve(process.cwd(), '.benchmarks')) {
    this.baseDir = baseDir;
    this.tokenCounter = new TokenCounter();
  }

  public async run(dataset: BenchmarkDataset): Promise<BenchmarkReport> {
    const repoDir = this.ensureRepository(dataset);
    const dbPath = path.join(repoDir, '.atlas', 'atlas.db');

    if (fs.existsSync(path.dirname(dbPath))) {
      fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
    }
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    const db = new AtlasDatabase(dbPath);
    runMigrations(db);

    const projectRow = db.get<{ id: number }>('SELECT id FROM projects WHERE root = ?', repoDir);
    let projectId = projectRow?.id;
    if (!projectId) {
      const res = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', dataset.name, repoDir);
      projectId = Number(res.lastInsertRowid);
    }

    console.log(`\n⏳ Indexing dataset repository: ${dataset.name}...`);
    const indexer = new Indexer({
      root: repoDir,
      db,
      projectId: projectId as number,
      includeTests: false,
    });
    await indexer.index();

    const fileRepo = new FileRepository(db);
    const allFiles = fileRepo.getAll(projectId as number);
    const filesByPath = new Map<string, FileInfo>(allFiles.map((f) => [f.relativePath, f]));

    // Calculate total raw tokens across the entire codebase
    let totalRepoRawTokens = 0;
    for (const file of allFiles) {
      const fullPath = path.join(repoDir, file.relativePath);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          totalRepoRawTokens += this.tokenCounter.count(content);
        } catch {
          // ignore binary / unreadable
        }
      }
    }

    const depRepo = new DependencyRepository(db);
    const deps = depRepo.getAll(projectId as number);
    const graph = new DependencyGraph();
    graph.addEdges(deps);

    const searchRepo = new SearchRepository(db);
    const retrieval = new RetrievalEngine(searchRepo, graph, filesByPath);
    const ruleEngine = new RuleEngine(repoDir);
    const rules = ruleEngine.discover();

    const projectMeta: ProjectMeta = {
      name: dataset.name,
      root: repoDir.replace(/\\/g, '/'),
      languages: ['javascript'],
      frameworks: [],
      packageManager: 'npm',
      fileCount: allFiles.length,
      symbolCount: 0,
      dependencyCount: deps.length,
      isMonorepo: false,
      workspaces: [],
    };

    const taskResults: TaskResult[] = [];

    console.log(`🧪 Running ${dataset.tasks.length} benchmark task queries...`);

    for (const task of dataset.tasks) {
      const start = performance.now();

      // 1. Retrieve candidates
      const retrievalResult = retrieval.retrieve(task.query, 15);

      // 2. Rank candidates
      const ranker = new Ranker({
        weights: {
          lexical_weight: 0.35,
          symbol_weight: 0.20,
          path_weight: 0.15,
          dependency_weight: 0.10,
          module_weight: 0.10,
          rule_weight: 0.05,
          recency_weight: 0.05,
        },
        queryTerms: retrievalResult.queryTerms,
      });
      const ranked = ranker.rank(retrievalResult.candidates);

      // 3. Build Context Pack
      const contextEngine = new ContextEngine({
        tokenBudget: 8000,
        defaultMode: 'signature',
        repositoryRoot: repoDir,
      });
      const pack = contextEngine.build({
        task: task.query,
        project: projectMeta,
        rankedResults: ranked,
        rules,
      });

      const durationMs = Math.round(performance.now() - start);

      const retrievedPaths = pack.files.map((f) => f.relativePath.replace(/\\/g, '/'));
      const normalizedExpected = task.expectedFiles.map((f) => f.replace(/\\/g, '/'));

      // Calculate precision and recall
      const hits = normalizedExpected.filter((exp) =>
        retrievedPaths.some((ret) => ret === exp || ret.endsWith(exp)),
      );

      const precision = retrievedPaths.length > 0 ? hits.length / retrievedPaths.length : 0;
      const recall = normalizedExpected.length > 0 ? hits.length / normalizedExpected.length : 0;

      const atlasTokens = pack.tokenUsage;
      const tokenSavingsPct =
        totalRepoRawTokens > 0
          ? Math.max(0, Math.round(((totalRepoRawTokens - atlasTokens) / totalRepoRawTokens) * 100))
          : 0;

      taskResults.push({
        taskId: task.id,
        query: task.query,
        retrievedFiles: retrievedPaths,
        expectedFiles: normalizedExpected,
        precision: Math.round(precision * 100) / 100,
        recall: Math.round(recall * 100) / 100,
        rawTokens: totalRepoRawTokens,
        atlasTokens,
        tokenSavingsPct,
        durationMs,
      });
    }

    db.close();

    const overallPrecision =
      Math.round(
        (taskResults.reduce((acc, t) => acc + t.precision, 0) / taskResults.length) * 100,
      ) / 100;
    const overallRecall =
      Math.round((taskResults.reduce((acc, t) => acc + t.recall, 0) / taskResults.length) * 100) /
      100;
    const overallTokenSavingsPct = Math.round(
      taskResults.reduce((acc, t) => acc + t.tokenSavingsPct, 0) / taskResults.length,
    );
    const averageLatencyMs = Math.round(
      taskResults.reduce((acc, t) => acc + t.durationMs, 0) / taskResults.length,
    );

    return {
      datasetName: dataset.name,
      timestamp: new Date().toISOString(),
      taskResults,
      overallPrecision,
      overallRecall,
      overallTokenSavingsPct,
      averageLatencyMs,
    };
  }

  private ensureRepository(dataset: BenchmarkDataset): string {
    const reposDir = path.join(this.baseDir, 'repos');
    fs.mkdirSync(reposDir, { recursive: true });

    const safeRepoName = dataset.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetDir = path.join(reposDir, safeRepoName);

    if (!fs.existsSync(path.join(targetDir, '.git'))) {
      console.log(`📦 Cloning benchmark target [${dataset.name}] into ${targetDir}...`);
      try {
        execSync(
          `git clone --depth 1 --branch ${dataset.branch} ${dataset.repositoryUrl} "${targetDir}"`,
          {
            stdio: 'inherit',
          },
        );
      } catch {
        // Fallback without branch if shallow branch fails
        execSync(`git clone --depth 1 ${dataset.repositoryUrl} "${targetDir}"`, {
          stdio: 'inherit',
        });
      }
    }

    return targetDir;
  }
}

import fs from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { GitService } from '@codeatlas/git';
import { Indexer } from '@codeatlas/indexer';
import { ContextEngine } from '@codeatlas/context';
import { RuleEngine } from '@codeatlas/rules';
import { createExporter } from '@codeatlas/exporters';
import { AtlasDatabase, runMigrations, FileRepository, SymbolRepository, DependencyRepository } from '@codeatlas/storage';
import type { ExportTarget, ProjectMeta } from '@codeatlas/core';

function getOrCreateProject(db: AtlasDatabase, cwd: string): number {
  const normalizedRoot = cwd.replace(/\\/g, '/');
  const existing = db.get<{ id: number }>('SELECT id FROM projects WHERE root = ?', normalizedRoot);
  if (existing) return existing.id;
  const name = path.basename(cwd);
  const result = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', name, normalizedRoot);
  return Number(result.lastInsertRowid);
}

export async function run(): Promise<void> {
  try {
    const root = process.env.GITHUB_WORKSPACE || process.cwd();
    const token = core.getInput('github-token') || process.env.GITHUB_TOKEN;
    const baseBranch = core.getInput('base-branch') || 'main';
    const targetAgent = (core.getInput('target-agent') || 'cursor') as ExportTarget;
    const tokenBudget = parseInt(core.getInput('token-budget') || '8000', 10);
    const postComment = core.getInput('post-comment') !== 'false';

    core.info(`🗺️ CodeAtlas GitHub Action running for ${root}`);
    core.info(`Comparing against base branch: ${baseBranch}`);

    const gitService = new GitService(root);
    const changedFiles = await gitService.getBranchChangedFiles(baseBranch);
    core.info(`Found ${changedFiles.length} changed files in PR`);

    if (changedFiles.length === 0) {
      core.info('No changed files detected. Skipping context generation.');
      return;
    }

    // Set up storage and indexer
    const dbPath = path.join(root, '.atlas', 'atlas.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new AtlasDatabase(dbPath);
    runMigrations(db);

    const projectId = getOrCreateProject(db, root);

    const indexer = new Indexer({
      db,
      root,
      projectId,
    });
    await indexer.index();

    // Get rules
    const ruleEngine = new RuleEngine(root);
    const rules = ruleEngine.discover();

    // Build context pack
    const contextEngine = new ContextEngine({
      tokenBudget,
      defaultMode: 'full',
      repositoryRoot: root,
    });

    const fileRepo = new FileRepository(db);
    const symbolRepo = new SymbolRepository(db);

    const rankedResults = changedFiles.map((file) => ({
      filePath: file,
      score: 1.0,
      relevance: 1.0,
      explanations: [{ signal: 'git-diff', score: 1.0, weight: 1.0, reason: 'Changed in Pull Request' }],
      candidate: {
        filePath: file,
        file: fileRepo.getByPath(projectId, file),
        sources: [{ type: 'path' as const, score: 1.0, detail: 'PR diff change' }],
      },
    }));

    const projectMeta: ProjectMeta = {
      name: path.basename(root),
      root,
      languages: ['typescript'],
      frameworks: [],
      packageManager: 'unknown',
      fileCount: fileRepo.count(projectId),
      symbolCount: symbolRepo.countByProject(projectId),
      dependencyCount: new DependencyRepository(db).count(projectId),
      isMonorepo: false,
      workspaces: [],
    };

    const pack = contextEngine.build({
      task: `Pull Request Context for changed files vs ${baseBranch}`,
      project: projectMeta,
      rankedResults,
      rules,
    });

    // Export formatted pack
    const exporter = createExporter(targetAgent);
    const outputContent = exporter.export(pack, { target: targetAgent });

    const outDir = path.join(root, '.atlas');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'pr-context.md');
    fs.writeFileSync(outFile, outputContent, 'utf-8');

    core.setOutput('context-file', outFile);
    core.setOutput('token-usage', pack.tokenUsage);
    core.setOutput('files-analyzed', pack.files.length);

    core.info(`✅ Generated Context Pack: ${pack.files.length} files, ${pack.tokenUsage} tokens -> ${outFile}`);

    // Post comment if applicable
    if (postComment && token && github.context.payload.pull_request) {
      const prNumber = github.context.payload.pull_request.number;
      const octokit = github.getOctokit(token);

      const commentBody = `### 🗺️ CodeAtlas AI PR Context Pack\n\n` +
        `> **Target Agent**: \`${targetAgent}\` | **Token Usage**: \`${pack.tokenUsage} / ${tokenBudget}\` | **Files Analyzed**: \`${pack.files.length}\`\n\n` +
        `<details>\n<summary>Click to view structured AI context for this PR</summary>\n\n` +
        `\`\`\`markdown\n${outputContent.slice(0, 50000)}\n\`\`\`\n\n` +
        `</details>\n\n*Generated locally with [CodeAtlas](https://github.com/codeatlas/codeatlas)*`;

      await octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: prNumber,
        body: commentBody,
      });

      core.info(`💬 Successfully posted context comment to PR #${prNumber}`);
    }

    db.close();
  } catch (error) {
    core.setFailed(`CodeAtlas GitHub Action failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (process.env.NODE_ENV !== 'test') {
  run().catch((err) => core.setFailed(err.message));
}

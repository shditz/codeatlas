import * as vscode from 'vscode';
import path from 'node:path';
import fs from 'node:fs';
import {
  AtlasDatabase,
  runMigrations,
  FileRepository,
  SymbolRepository,
  DependencyRepository,
  SearchRepository,
  ProjectRepository,
} from '@codeatlas/storage';
import { Indexer, RepositoryWatcher } from '@codeatlas/indexer';
import { ContextEngine } from '@codeatlas/context';
import { RuleEngine } from '@codeatlas/rules';
import { createExporter } from '@codeatlas/exporters';
import { GitService } from '@codeatlas/git';
import {
  DependencyGraph,
  GraphQueryEngine,
  type GraphNodeItem,
  type GraphEdgeItem,
} from '@codeatlas/graph';
import { RetrievalEngine } from '@codeatlas/retrieval';
import type { ExportTarget, ProjectMeta, SymbolInfo } from '@codeatlas/core';
import { CodeAtlasOverviewProvider, CodeAtlasRulesProvider } from './providers/tree-provider.js';
import { GraphViewProvider } from './providers/graph-view-provider.js';

let db: AtlasDatabase | null = null;
let watcher: RepositoryWatcher | null = null;
let overviewProvider: CodeAtlasOverviewProvider;
let rulesProvider: CodeAtlasRulesProvider;
let outputChannel: vscode.OutputChannel;

function getOrCreateProject(database: AtlasDatabase, cwd: string): number {
  const normalizedRoot = cwd.replace(/\\/g, '/');
  const existing = database.get<{ id: number }>(
    'SELECT id FROM projects WHERE root = ?',
    normalizedRoot,
  );
  if (existing) return existing.id;
  const name = path.basename(cwd);
  const result = database.run(
    'INSERT INTO projects (name, root) VALUES (?, ?)',
    name,
    normalizedRoot,
  );
  return Number(result.lastInsertRowid);
}

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('CodeAtlas');
  outputChannel.appendLine('CodeAtlas Extension Activated');

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  let projectId = 1;

  if (workspaceRoot) {
    const dbPath = path.join(workspaceRoot, '.atlas', 'atlas.db');
    if (fs.existsSync(dbPath)) {
      try {
        db = new AtlasDatabase(dbPath);
        runMigrations(db);
        projectId = getOrCreateProject(db, workspaceRoot);
      } catch (err) {
        outputChannel.appendLine(`Failed to load database: ${err}`);
      }
    }
  }

  overviewProvider = new CodeAtlasOverviewProvider(db, workspaceRoot, projectId);
  rulesProvider = new CodeAtlasRulesProvider(workspaceRoot);

  vscode.window.registerTreeDataProvider('codeatlas.overview', overviewProvider);
  vscode.window.registerTreeDataProvider('codeatlas.rules', rulesProvider);

  // Watch for AI rules changes
  const rulesWatcher = vscode.workspace.createFileSystemWatcher(
    '**/{.cursorrules,.windsurfrules,.clinerules,.traerules,.lingmarules,.comaterules,.codegeexrules,.roorules,.augmentrules,AGENTS.md,CLAUDE.md,GEMINI.md,DEEPSEEK.md,QWEN.md,KIMI.md,GROK.md,DEVIN.md,OPENHANDS.md,REPLIT.md,AMAZONQ.md,ANTIGRAVITY.md}',
  );
  rulesWatcher.onDidChange(() => rulesProvider.refresh());
  rulesWatcher.onDidCreate(() => rulesProvider.refresh());
  rulesWatcher.onDidDelete(() => rulesProvider.refresh());
  context.subscriptions.push(rulesWatcher);

  // Command 1: Index Codebase
  context.subscriptions.push(
    vscode.commands.registerCommand('codeatlas.indexCodebase', async () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'CodeAtlas: Indexing codebase...',
          cancellable: false,
        },
        async () => {
          const dbPath = path.join(workspaceRoot, '.atlas', 'atlas.db');
          fs.mkdirSync(path.dirname(dbPath), { recursive: true });
          db = new AtlasDatabase(dbPath);
          runMigrations(db);

          projectId = getOrCreateProject(db, workspaceRoot);

          const indexer = new Indexer({
            db,
            root: workspaceRoot,
            projectId,
          });
          const result = await indexer.index();

          overviewProvider.setDatabase(db, projectId);
          rulesProvider.refresh();

          if (result.errors && result.errors.length > 0) {
            vscode.window.showWarningMessage(
              `CodeAtlas: Indexed with ${result.errors.length} errors. First error: ${result.errors[0]}`,
            );
          } else {
            vscode.window.showInformationMessage(
              `CodeAtlas: Indexed ${result.filesIndexed} files, ${result.symbolsExtracted} symbols, ${result.dependenciesCreated} dependencies in ${result.duration}ms`,
            );
          }
        },
      );
    }),
  );

  // Command 2: Export Context
  context.subscriptions.push(
    vscode.commands.registerCommand('codeatlas.exportContext', async (uri?: vscode.Uri) => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }

      const activeFile = uri?.fsPath || vscode.window.activeTextEditor?.document.uri.fsPath;
      const task = await vscode.window.showInputBox({
        prompt: 'Describe your coding task for the AI agent',
        value: activeFile
          ? `Work on ${path.relative(workspaceRoot, activeFile)}`
          : 'Analyze codebase',
      });

      if (!task) return;

      const agent = ((await vscode.window.showQuickPick(
        ['cursor', 'claude', 'antigravity', 'deepseek', 'trae', 'qwen', 'kimi', 'grok', 'markdown'],
        { placeHolder: 'Select target AI agent format' },
      )) || 'cursor') as ExportTarget;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `CodeAtlas: Generating context pack for ${agent}...`,
          cancellable: false,
        },
        async (progress) => {
          try {
            const dbPath = path.join(workspaceRoot, '.atlas', 'atlas.db');
            if (!fs.existsSync(dbPath)) {
              progress.report({ message: 'Indexing repository...' });
              await vscode.commands.executeCommand('codeatlas.indexCodebase');
            }

            if (!db) {
              db = new AtlasDatabase(dbPath);
              runMigrations(db);
            }

            projectId = getOrCreateProject(db, workspaceRoot);

            progress.report({ message: 'Analyzing dependencies and rules...' });
            const fileRepo = new FileRepository(db);
            const symbolRepo = new SymbolRepository(db);
            const files = fileRepo.getAll(projectId);
            const symbols: SymbolInfo[] = files.flatMap((f) =>
              f.id ? symbolRepo.getByFile(f.id) : [],
            );

            const ruleEngine = new RuleEngine(workspaceRoot);
            const rules = ruleEngine.discover();

            const contextEngine = new ContextEngine({
              tokenBudget: 8000,
              defaultMode: 'full',
              repositoryRoot: workspaceRoot,
            });

            progress.report({ message: 'Retrieving semantic matches...' });
            const searchRepo = new SearchRepository(db);
            const depRepo = new DependencyRepository(db);
            const deps = depRepo.getAll(projectId);
            const graph = new DependencyGraph();
            graph.addEdges(deps);

            const filesByPath = new Map(files.map((f) => [f.relativePath, f]));
            const retrievalEngine = new RetrievalEngine(searchRepo, graph, filesByPath);

            const result = retrievalEngine.retrieve(task, 15);

            const rankedResults = result.candidates.map((candidate) => ({
              filePath: candidate.filePath,
              score: candidate.sources.reduce((sum, s) => sum + s.score, 0),
              relevance: 1.0,
              explanations: candidate.sources.map((s) => ({
                signal: s.type,
                score: s.score,
                weight: 1.0,
                reason: s.detail,
              })),
              candidate: candidate,
            }));

            const projectRepo = new ProjectRepository(db);
            const projectRecord = projectRepo.getById(projectId);

            const projectMeta: ProjectMeta = {
              name: projectRecord?.name || path.basename(workspaceRoot),
              root: workspaceRoot,
              languages: (projectRecord?.languages as any) || ['typescript'],
              frameworks: (projectRecord?.frameworks as any) || [],
              packageManager: (projectRecord?.packageManager as any) || 'pnpm',
              fileCount: files.length,
              symbolCount: symbols.length,
              dependencyCount: deps.length,
              isMonorepo: projectRecord?.isMonorepo ?? false,
              workspaces: projectRecord?.workspaces || [],
            };

            const pack = contextEngine.build({
              task,
              project: projectMeta,
              rankedResults,
              rules,
            });

            const exporter = createExporter(agent);
            const output = exporter.export(pack, { target: agent });

            await vscode.env.clipboard.writeText(output);
            vscode.window.showInformationMessage(
              `CodeAtlas: Context Pack (${pack.tokenUsage} tokens, ${pack.files.length} files) copied to clipboard for ${agent}!`,
            );
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`CodeAtlas Context Export failed: ${msg}`);
          }
        },
      );
    }),
  );

  // Command 3: Generate PR Context
  context.subscriptions.push(
    vscode.commands.registerCommand('codeatlas.generatePRContext', async () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }

      try {
        const gitService = new GitService(workspaceRoot);
        const baseBranch =
          (await vscode.window.showInputBox({
            prompt: 'Enter base branch to compare against',
            value: 'main',
          })) || 'main';

        const changed = gitService.getBranchChangedFiles(baseBranch);
        vscode.window.showInformationMessage(
          `CodeAtlas: Found ${changed.length} changed files vs ${baseBranch}.`,
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `CodeAtlas Git Service: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
  );

  // Command 4: Run Cypher Graph Query
  context.subscriptions.push(
    vscode.commands.registerCommand('codeatlas.queryGraph', async () => {
      const presets = [
        { label: '🔍 Custom Cypher Query...', description: 'Write custom graph query', query: '' },
        {
          label: '📁 List All Files & Languages',
          description: 'Overview of indexed files',
          query: 'MATCH (f:File) RETURN f.name, f.language, f.lines',
        },
        {
          label: '🏗️ File Dependency Relations',
          description: 'Show which files import which',
          query: 'MATCH (a:File)-[r:DEPENDS_ON]->(b:File) RETURN a.name, b.name',
        },
        {
          label: '🧩 List All Symbols (Functions/Classes)',
          description: 'Extract all declared symbols',
          query: 'MATCH (s:Symbol) RETURN s.name, s.kind, s.file',
        },
        {
          label: '⚡ Core Architecture Hubs',
          description: 'Files with dependencies',
          query: 'MATCH (f:File)-[r:DEPENDS_ON]->(target) RETURN f.name, target.name',
        },
      ];

      const selected = await vscode.window.showQuickPick(presets, {
        placeHolder: 'Select a query preset or choose Custom Query',
      });

      if (!selected) return;

      let queryString = selected.query;
      if (!queryString) {
        queryString =
          (await vscode.window.showInputBox({
            prompt: 'Enter Cypher-like graph query',
            value: 'MATCH (f:File) RETURN f.name, f.language',
          })) || '';
      }

      if (!queryString) return;

      if (!db && workspaceRoot) {
        const dbPath = path.join(workspaceRoot, '.atlas', 'atlas.db');
        if (fs.existsSync(dbPath)) {
          db = new AtlasDatabase(dbPath);
          runMigrations(db);
        }
      }

      if (!db) {
        vscode.window.showErrorMessage('CodeAtlas: Codebase is not indexed yet.');
        return;
      }

      try {
        projectId = getOrCreateProject(db, workspaceRoot);
        const fileRepo = new FileRepository(db);
        const symbolRepo = new SymbolRepository(db);
        const depRepo = new DependencyRepository(db);

        const files = fileRepo.getAll(projectId);
        const symbols: SymbolInfo[] = files.flatMap((f) =>
          f.id ? symbolRepo.getByFile(f.id).map((s) => ({ ...s, filePath: f.relativePath })) : [],
        );
        const deps = depRepo.getAll(projectId);

        const nodes: GraphNodeItem[] = [
          ...files.map((f) => ({
            id: f.relativePath,
            label: 'File',
            properties: {
              name: f.relativePath.split('/').pop() || f.relativePath,
              path: f.relativePath,
              language: f.language,
              lines: f.size,
            },
          })),
          ...symbols.map((s: SymbolInfo) => ({
            id: `${s.filePath}:${s.name}`,
            label: 'Symbol',
            properties: { name: s.name, kind: s.kind, file: s.filePath },
          })),
        ];

        const edges: GraphEdgeItem[] = deps.map((d) => ({
          source: d.source,
          target: d.target,
          type: d.kind.toUpperCase(),
          properties: { weight: d.weight },
        }));

        const graph = new DependencyGraph();
        const engine = new GraphQueryEngine(graph, nodes, edges);

        const result = engine.execute(queryString);
        outputChannel.clear();
        outputChannel.appendLine(
          `=== CodeAtlas Graph Query Results (${result.count} rows, ${result.executionTimeMs}ms) ===`,
        );
        outputChannel.appendLine(JSON.stringify(result.rows, null, 2));
        outputChannel.show();
      } catch (err) {
        vscode.window.showErrorMessage(
          `Query Error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
  );

  // Command 5: Toggle Watcher
  context.subscriptions.push(
    vscode.commands.registerCommand('codeatlas.toggleWatcher', async () => {
      if (!workspaceRoot) return;

      if (watcher) {
        watcher.stop();
        watcher = null;
        vscode.window.showInformationMessage('CodeAtlas: Real-time watcher stopped.');
      } else {
        const dbPath = path.join(workspaceRoot, '.atlas', 'atlas.db');
        if (!fs.existsSync(dbPath)) {
          const action = await vscode.window.showWarningMessage(
            'CodeAtlas: Database not found. You must index the workspace first.',
            'Index Now'
          );
          if (action === 'Index Now') {
            vscode.commands.executeCommand('codeatlas.indexWorkspace');
          }
          return;
        }
        if (!db) {
          db = new AtlasDatabase(dbPath);
          runMigrations(db);
        }
        projectId = getOrCreateProject(db, workspaceRoot);
        watcher = new RepositoryWatcher({
          root: workspaceRoot,
          db,
          projectId,
        });
        watcher.start();
        vscode.window.showInformationMessage('CodeAtlas: Real-time watcher started.');
      }
    }),
  );

  // Command 6: Open Graph View
  context.subscriptions.push(
    vscode.commands.registerCommand('codeatlas.openGraphView', () => {
      GraphViewProvider.createOrShow(context.extensionUri, db, projectId);
    }),
  );
}

export function deactivate(): void {
  if (watcher) {
    watcher.stop();
    watcher = null;
  }
  if (db) {
    db.close();
    db = null;
  }
}

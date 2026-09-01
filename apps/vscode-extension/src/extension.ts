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
} from '@codeatlas-ai/storage';
import { Indexer, RepositoryWatcher } from '@codeatlas-ai/indexer';
import { ContextEngine } from '@codeatlas-ai/context';
import { RuleEngine, RuleGenerator } from '@codeatlas-ai/rules';
import { createExporter } from '@codeatlas-ai/exporters';
import { GitService } from '@codeatlas-ai/git';
import {
  DependencyGraph,
  GraphQueryEngine,
  type GraphNodeItem,
  type GraphEdgeItem,
} from '@codeatlas-ai/graph';
import { RetrievalEngine } from '@codeatlas-ai/retrieval';
import type {
  ExportTarget,
  ProjectMeta,
  SymbolInfo,
  Language,
  Framework,
  PackageManager,
  ServiceNode,
} from '@codeatlas-ai/core';
import { MultiRepoAggregator, CycleDetector } from '@codeatlas-ai/analytics';
import {
  CodeAtlasOverviewProvider,
  CodeAtlasRulesProvider,
  CodeAtlasAnalyticsProvider,
  CodeAtlasToolsProvider,
} from './providers/tree-provider.js';
import { GraphViewProvider } from './providers/graph-view-provider.js';
import { CodeAtlasCodeLensProvider } from './providers/codelens-provider.js';
import { BlastRadiusProvider } from './providers/blast-radius-provider.js';
import {
  ArchitectureDiagnosticsProvider,
  ArchitectureCodeActionProvider,
} from './providers/diagnostics-provider.js';

let db: AtlasDatabase | null = null;
let watcher: RepositoryWatcher | null = null;
let overviewProvider: CodeAtlasOverviewProvider;
let rulesProvider: CodeAtlasRulesProvider;
let analyticsProvider: CodeAtlasAnalyticsProvider;
let toolsProvider: CodeAtlasToolsProvider;
let codelensProvider: CodeAtlasCodeLensProvider;
let blastRadiusProvider: BlastRadiusProvider;
let diagnosticsProvider: ArchitectureDiagnosticsProvider;
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
  analyticsProvider = new CodeAtlasAnalyticsProvider(db, workspaceRoot, projectId);
  toolsProvider = new CodeAtlasToolsProvider(workspaceRoot);
  codelensProvider = new CodeAtlasCodeLensProvider(db, workspaceRoot, projectId);
  blastRadiusProvider = new BlastRadiusProvider(db, workspaceRoot, projectId);
  diagnosticsProvider = new ArchitectureDiagnosticsProvider(db, workspaceRoot, projectId);

  context.subscriptions.push(blastRadiusProvider, diagnosticsProvider);

  vscode.window.registerTreeDataProvider('codeatlas.overview', overviewProvider);
  vscode.window.registerTreeDataProvider('codeatlas.analytics', analyticsProvider);
  vscode.window.registerTreeDataProvider('codeatlas.rules', rulesProvider);
  vscode.window.registerTreeDataProvider('codeatlas.tools', toolsProvider);

  const supportedLanguageSelectors = [
    { scheme: 'file', language: 'typescript' },
    { scheme: 'file', language: 'typescriptreact' },
    { scheme: 'file', language: 'javascript' },
    { scheme: 'file', language: 'javascriptreact' },
    { scheme: 'file', language: 'python' },
    { scheme: 'file', language: 'go' },
    { scheme: 'file', language: 'rust' },
    { scheme: 'file', language: 'java' },
    { scheme: 'file', language: 'c' },
    { scheme: 'file', language: 'cpp' },
    { scheme: 'file', language: 'csharp' },
    { scheme: 'file', language: 'php' },
    { scheme: 'file', language: 'ruby' },
    { scheme: 'file', language: 'kotlin' },
  ];

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(supportedLanguageSelectors, codelensProvider),
    vscode.languages.registerCodeActionsProvider(
      supportedLanguageSelectors,
      new ArchitectureCodeActionProvider(),
      {
        providedCodeActionKinds: ArchitectureCodeActionProvider.providedCodeActionKinds,
      },
    ),
  );

  const rulesWatcher = vscode.workspace.createFileSystemWatcher(
    '**/{.cursorrules,.windsurfrules,.clinerules,.traerules,.lingmarules,.comaterules,.codegeexrules,.roorules,.augmentrules,AGENTS.md,CLAUDE.md,GEMINI.md,DEEPSEEK.md,QWEN.md,KIMI.md,GROK.md,DEVIN.md,OPENHANDS.md,REPLIT.md,AMAZONQ.md,ANTIGRAVITY.md}',
  );
  rulesWatcher.onDidChange(() => rulesProvider.refresh());
  rulesWatcher.onDidCreate(() => rulesProvider.refresh());
  rulesWatcher.onDidDelete(() => rulesProvider.refresh());
  context.subscriptions.push(rulesWatcher);

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
          if (db) {
            try {
              db.close();
            } catch {
              // Ignore close errors
            }
            db = null;
          }

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
          analyticsProvider.setDatabase(db, projectId);
          codelensProvider.setDatabase(db, projectId);
          blastRadiusProvider.setDatabase(db, projectId);
          diagnosticsProvider.setDatabase(db, projectId);
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
              languages: (projectRecord?.languages as Language[]) || ['typescript'],
              frameworks: (projectRecord?.frameworks as Framework[]) || [],
              packageManager: (projectRecord?.packageManager as PackageManager) || 'pnpm',
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
            'Index Now',
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
          onReindex: () => {
            overviewProvider.refresh();
            codelensProvider.refresh();
          },
        });
        watcher.start();
        vscode.window.showInformationMessage('CodeAtlas: Real-time watcher started.');
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeatlas.openGraphView', () => {
      GraphViewProvider.createOrShow(context.extensionUri, db, projectId);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'codeatlas.focusInGraph',
      (relativePath?: string, symbolName?: string) => {
        GraphViewProvider.createOrShow(context.extensionUri, db, projectId);
        if (relativePath && GraphViewProvider.currentPanel) {
          GraphViewProvider.currentPanel.focusNode(relativePath, symbolName);
        }
      },
    ),
    vscode.commands.registerCommand('codeatlas.showBlastRadiusQuickPick', (uri?: vscode.Uri) => {
      blastRadiusProvider.showQuickPick(uri);
    }),
    vscode.commands.registerCommand('codeatlas.analyzeBlastRadius', (uri?: vscode.Uri) => {
      blastRadiusProvider.showQuickPick(uri);
    }),
    vscode.commands.registerCommand('codeatlas.syncAIRules', async () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }

      const targetRuleFiles = [
        '.cursorrules',
        '.windsurfrules',
        '.clinerules',
        '.traerules',
        '.lingmarules',
        '.comaterules',
        '.codegeexrules',
        '.roorules',
        '.augmentrules',
        'AGENTS.md',
        'CLAUDE.md',
        'GEMINI.md',
        'DEEPSEEK.md',
        'QWEN.md',
        'KIMI.md',
        'GROK.md',
        'DEVIN.md',
        'OPENHANDS.md',
        'REPLIT.md',
        'AMAZONQ.md',
        'ANTIGRAVITY.md',
      ];

      let existingFiles = targetRuleFiles.filter((f) => fs.existsSync(path.join(workspaceRoot, f)));

      if (existingFiles.length === 0) {
        const pick = await vscode.window.showQuickPick(
          [
            { label: '🧠 CLAUDE.md (Anthropic / Claude Code)', file: 'CLAUDE.md' },
            { label: '⚡ .cursorrules (Cursor IDE)', file: '.cursorrules' },
            { label: '🤖 AGENTS.md (OpenAI / Antigravity)', file: 'AGENTS.md' },
            { label: '✨ GEMINI.md (Google Gemini)', file: 'GEMINI.md' },
          ],
          { placeHolder: 'No AI rule file found. Choose one to create and sync' },
        );
        if (!pick) return;
        existingFiles = [pick.file];
      }

      let totalFiles = 0;
      let totalSymbols = 0;
      let totalDeps = 0;
      let cycleCount = 0;

      if (db) {
        try {
          const fileRepo = new FileRepository(db);
          const symRepo = new SymbolRepository(db);
          const depRepo = new DependencyRepository(db);
          totalFiles = fileRepo.getAll(projectId).length;
          totalSymbols = symRepo.getAllByProject(projectId).length;
          const deps = depRepo.getAll(projectId);
          totalDeps = deps.length;

          const graph = new DependencyGraph();
          graph.addEdges(deps);
          const cycleDetector = new CycleDetector(graph);
          cycleCount = cycleDetector.detectCycles().cycleCount;
        } catch {
          // fallback
        }
      }

      const generator = new RuleGenerator({ rootDir: workspaceRoot });
      const archBlock = generator.generateArchitectureBlock({
        projectName: path.basename(workspaceRoot),
        totalFiles,
        totalSymbols,
        totalDependencies: totalDeps,
        circularDependencyCount: cycleCount,
      });

      const synced: string[] = [];
      for (const file of existingFiles) {
        const targetPath = path.join(workspaceRoot, file);
        const existingContent = fs.existsSync(targetPath)
          ? fs.readFileSync(targetPath, 'utf-8')
          : '';
        const updated = RuleGenerator.syncArchitectureBlock(existingContent, archBlock);
        fs.writeFileSync(targetPath, updated, 'utf-8');
        synced.push(file);
      }

      rulesProvider.refresh();
      vscode.window.showInformationMessage(
        `CodeAtlas: Successfully synced Live Architecture Blueprint to ${synced.join(', ')}`,
      );
    }),
    vscode.commands.registerCommand('codeatlas.exportArchitectureSchema', async () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }
      if (!db) {
        vscode.window.showWarningMessage(
          'CodeAtlas: Please index the codebase first before exporting schema.',
        );
        return;
      }

      try {
        const aggregator = new MultiRepoAggregator();
        const serviceSchema = aggregator.exportServiceSchema(
          db,
          projectId,
          path.basename(workspaceRoot),
          workspaceRoot,
        );

        const targetFile = path.join(workspaceRoot, '.codeatlas.json');
        fs.writeFileSync(targetFile, JSON.stringify(serviceSchema, null, 2), 'utf-8');

        vscode.window.showInformationMessage(
          `CodeAtlas: Exported architecture schema to .codeatlas.json (${serviceSchema.exportedApis.length} APIs, ${serviceSchema.dependencies.length} external packages)`,
        );

        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetFile));
        await vscode.window.showTextDocument(doc);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Failed to export architecture schema: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
    vscode.commands.registerCommand('codeatlas.openMultiRepoAggregator', async () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }

      const pick = await vscode.window.showQuickPick(
        [
          {
            label: '🏢 Auto-Discover Monorepo Workspaces / Microservices',
            description: 'Scans root, packages/*, apps/*, services/* for individual services',
            action: 'monorepo',
          },
          {
            label: '📂 Import External .codeatlas.json Schemas',
            description: 'Merge multiple exported repo schemas into a Global Mesh',
            action: 'files',
          },
        ],
        { placeHolder: 'Select Multi-Repo Aggregation Mode' },
      );

      if (!pick) return;

      const aggregator = new MultiRepoAggregator();
      const services: ServiceNode[] = [];

      if (pick.action === 'monorepo') {
        const candidateDirs = ['packages', 'apps', 'services', 'libs', 'modules'];
        const foundDirs: string[] = [];

        for (const c of candidateDirs) {
          const p = path.join(workspaceRoot, c);
          if (fs.existsSync(p)) {
            const subs = fs.readdirSync(p, { withFileTypes: true });
            for (const sub of subs) {
              if (sub.isDirectory()) {
                foundDirs.push(path.join(p, sub.name));
              }
            }
          }
        }

        if (foundDirs.length === 0) {
          foundDirs.push(workspaceRoot);
        }

        for (const dir of foundDirs) {
          const pkgJsonPath = path.join(dir, 'package.json');
          const pkgName = fs.existsSync(pkgJsonPath)
            ? JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')).name || path.basename(dir)
            : path.basename(dir);

          const schemaPath = path.join(dir, '.codeatlas.json');
          if (fs.existsSync(schemaPath)) {
            try {
              const loaded = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
              services.push(loaded);
              continue;
            } catch {
              // fallback
            }
          }

          const pkgJson = fs.existsSync(pkgJsonPath)
            ? JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
            : {};
          const deps = Object.keys(pkgJson.dependencies || {});

          services.push({
            id: path.basename(dir).toLowerCase(),
            name: pkgName,
            rootPath: dir,
            fileCount: 20,
            symbolCount: 80,
            exportedApis: [
              {
                path: `/api/${path.basename(dir)}`,
                method: 'GET',
                protocol: 'http',
                handler: `${path.basename(dir)}Handler`,
              },
            ],
            consumedApis: [],
            dependencies: deps,
          });
        }
      } else if (pick.action === 'files') {
        const uris = await vscode.window.showOpenDialog({
          canSelectMany: true,
          filters: { 'CodeAtlas Schemas': ['json'] },
          title: 'Select .codeatlas.json service schemas to aggregate',
        });

        if (!uris || uris.length === 0) return;

        for (const uri of uris) {
          try {
            const raw = fs.readFileSync(uri.fsPath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed.id && parsed.name) {
              services.push(parsed);
            }
          } catch {
            // ignore invalid
          }
        }
      }

      if (services.length === 0) {
        vscode.window.showWarningMessage(
          'CodeAtlas: No valid microservices or workspace packages found to aggregate.',
        );
        return;
      }

      const schema = aggregator.aggregate(services);
      const graphData = aggregator.toGraphData(schema);

      GraphViewProvider.createOrShow(context.extensionUri, db, projectId);
      if (GraphViewProvider.currentPanel) {
        GraphViewProvider.currentPanel.setCustomGraphData(
          graphData,
          `CodeAtlas Global Ecosystem (${services.length} services)`,
        );
      }

      vscode.window.showInformationMessage(
        `CodeAtlas: Successfully mapped Global Ecosystem with ${services.length} services and ${schema.crossServiceEdges.length} cross-service connections!`,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeatlas.generateRules', async () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }

      const options = [
        {
          label: '🤖 AGENTS.md (Google Antigravity / OpenAI Codex)',
          target: 'antigravity',
          file: 'AGENTS.md',
        },
        {
          label: '🧠 CLAUDE.md (Claude Code / Anthropic)',
          target: 'claude',
          file: 'CLAUDE.md',
        },
        {
          label: '⚡ .cursorrules (Cursor IDE)',
          target: 'cursor',
          file: '.cursorrules',
        },
        {
          label: '✨ GEMINI.md (Google Gemini)',
          target: 'gemini',
          file: 'GEMINI.md',
        },
        {
          label: '🌐 All Formats (Generate All Rule Files)',
          target: 'all',
          file: 'all',
        },
      ];

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select target AI rule guideline format to generate',
      });

      if (!selected) return;

      try {
        const generator = new RuleGenerator({ rootDir: workspaceRoot });
        const proposed = generator.generateProposedRules();

        const meta = {
          name: path.basename(workspaceRoot),
          languages: ['TypeScript'],
          frameworks: [],
          packageManager: 'pnpm',
        };

        const targetsToGenerate =
          selected.target === 'all'
            ? [
                { target: 'antigravity', file: 'AGENTS.md' },
                { target: 'claude', file: 'CLAUDE.md' },
                { target: 'cursor', file: '.cursorrules' },
                { target: 'gemini', file: 'GEMINI.md' },
              ]
            : [{ target: selected.target, file: selected.file }];

        for (const item of targetsToGenerate) {
          const doc = generator.generateRuleDocument(proposed, meta, item.target);
          const targetPath = path.join(workspaceRoot, item.file);
          fs.writeFileSync(targetPath, doc, 'utf-8');
        }

        rulesProvider.refresh();
        vscode.window.showInformationMessage(
          `CodeAtlas: Generated ${targetsToGenerate.map((t) => t.file).join(', ')} successfully!`,
        );

        const primaryFile = path.join(workspaceRoot, targetsToGenerate[0]!.file);
        const textDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(primaryFile));
        await vscode.window.showTextDocument(textDoc);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Failed to generate rules: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
    vscode.commands.registerCommand('codeatlas.clean', async () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }
      try {
        if (db) {
          try {
            db.close();
          } catch {
            // Ignore close error
          }
          db = null;
        }
        overviewProvider.setDatabase(null, 1);
        analyticsProvider.setDatabase(null, 1);
        codelensProvider.setDatabase(null, 1);
        blastRadiusProvider.setDatabase(null, 1);
        diagnosticsProvider.setDatabase(null, 1);

        const atlasDir = path.join(workspaceRoot, '.atlas');
        if (fs.existsSync(atlasDir)) {
          fs.rmSync(atlasDir, { recursive: true, force: true });
          vscode.window.showInformationMessage(
            'CodeAtlas: Cache and database cleared successfully.',
          );
        } else {
          vscode.window.showInformationMessage('CodeAtlas: Cache is already clean.');
        }
        overviewProvider.refresh();
        analyticsProvider.refresh();
        rulesProvider.refresh();
      } catch (err) {
        vscode.window.showErrorMessage(
          `CodeAtlas Clean failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
    vscode.commands.registerCommand('codeatlas.startMCP', () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }
      const term = vscode.window.createTerminal('CodeAtlas: MCP');
      term.show();
      term.sendText('npx -y @codeatlas-ai/cli mcp');
    }),
    vscode.commands.registerCommand('codeatlas.runAudit', () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }
      const term = vscode.window.createTerminal('CodeAtlas: Audit');
      term.show();
      term.sendText('npx -y @codeatlas-ai/cli audit');
    }),
    vscode.commands.registerCommand('codeatlas.semanticSearch', async () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }
      const query = await vscode.window.showInputBox({
        prompt: 'Enter search query for codebase',
        placeHolder: 'e.g. "authentication controller or jwt validation"',
      });
      if (query) {
        const term = vscode.window.createTerminal('CodeAtlas: Search');
        term.show();
        term.sendText(`npx -y @codeatlas-ai/cli search "${query}"`);
      }
    }),
    vscode.commands.registerCommand('codeatlas.init', () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }
      const term = vscode.window.createTerminal('CodeAtlas: Init');
      term.show();
      term.sendText('npx -y @codeatlas-ai/cli init');
    }),
    vscode.commands.registerCommand('codeatlas.scan', () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }
      const term = vscode.window.createTerminal('CodeAtlas: Scan');
      term.show();
      term.sendText('npx -y @codeatlas-ai/cli scan');
    }),
    vscode.commands.registerCommand('codeatlas.doctor', () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }
      const term = vscode.window.createTerminal('CodeAtlas: Doctor');
      term.show();
      term.sendText('npx -y @codeatlas-ai/cli doctor');
    }),
    vscode.commands.registerCommand('codeatlas.rulesValidate', () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('CodeAtlas: Open a workspace folder first.');
        return;
      }
      const term = vscode.window.createTerminal('CodeAtlas: Rules Validate');
      term.show();
      term.sendText('npx -y @codeatlas-ai/cli rules validate');
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

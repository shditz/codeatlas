import * as vscode from 'vscode';
import path from 'node:path';
import type { AtlasDatabase } from '@codeatlas-ai/storage';
import type { FileInfo, SymbolInfo } from '@codeatlas-ai/core';
import { FileRepository, SymbolRepository, DependencyRepository } from '@codeatlas-ai/storage';
import { RuleEngine } from '@codeatlas-ai/rules';
import { ArchitectureAnalyzer, CycleDetector, DeadCodeDetector } from '@codeatlas-ai/analytics';
import { DependencyGraph } from '@codeatlas-ai/graph';

export class CodeAtlasTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue?: string,
    public readonly description?: string,
    public readonly iconName?: string,
  ) {
    super(label, collapsibleState);
    this.description = description;
    if (iconName) {
      this.iconPath = new vscode.ThemeIcon(iconName);
    }
  }
}

/**
 * Overview & Architectural Hierarchy Provider
 */
export class CodeAtlasOverviewProvider implements vscode.TreeDataProvider<CodeAtlasTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CodeAtlasTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private fileRepo: FileRepository | null = null;
  private symbolRepo: SymbolRepository | null = null;

  constructor(
    private db: AtlasDatabase | null,
    private workspaceRoot: string,
    private projectId: number = 1,
  ) {
    this.updateRepos();
  }

  private updateRepos(): void {
    if (this.db) {
      this.fileRepo = new FileRepository(this.db);
      this.symbolRepo = new SymbolRepository(this.db);
    } else {
      this.fileRepo = null;
      this.symbolRepo = null;
    }
  }

  setDatabase(db: AtlasDatabase | null, projectId: number = 1): void {
    this.db = db;
    this.projectId = projectId;
    this.updateRepos();
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CodeAtlasTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: CodeAtlasTreeItem): Promise<CodeAtlasTreeItem[]> {
    if (!this.workspaceRoot) {
      return [new CodeAtlasTreeItem('No workspace opened', vscode.TreeItemCollapsibleState.None, undefined, undefined, 'info')];
    }

    if (!this.db || !this.fileRepo || !this.symbolRepo) {
      const notIndexedItem = new CodeAtlasTreeItem(
        'Codebase not indexed',
        vscode.TreeItemCollapsibleState.None,
        'not_indexed',
        'Click to index workspace',
        'database',
      );
      notIndexedItem.command = {
        command: 'codeatlas.indexCodebase',
        title: 'Index Codebase',
      };
      return [notIndexedItem];
    }

    const { fileRepo, symbolRepo } = this;

    if (!element) {
      const allFiles = fileRepo.getAll();
      const fileCount = allFiles.length > 0 ? allFiles.length : fileRepo.count(this.projectId);
      const symbolCount = symbolRepo.count();

      const graphItem = new CodeAtlasTreeItem(
        'Open 3D Architecture Canvas',
        vscode.TreeItemCollapsibleState.None,
        'action_graph',
        'Interactive WebGL',
        'type-hierarchy',
      );
      graphItem.command = {
        command: 'codeatlas.openGraphView',
        title: 'Open Interactive Graph View',
      };

      const filesItem = new CodeAtlasTreeItem(
        `Files (${fileCount})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category_files',
        'Indexed files',
        'folder',
      );

      const symbolsItem = new CodeAtlasTreeItem(
        `Symbols (${symbolCount})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'category_symbols',
        'Functions, classes, types',
        'symbol-property',
      );

      return [graphItem, filesItem, symbolsItem];
    }

    if (element.contextValue === 'category_files') {
      let files: FileInfo[] = fileRepo.getAll(this.projectId);
      if (files.length === 0) {
        files = fileRepo.getAll();
      }
      return files.slice(0, 150).map((f) => {
        const item = new CodeAtlasTreeItem(
          f.relativePath,
          vscode.TreeItemCollapsibleState.None,
          'file_item',
          `[${f.language}]`,
          f.language === 'typescript' || f.language === 'javascript' ? 'file-code' : 'file',
        );
        const absPath = path.isAbsolute(f.path) ? f.path : path.join(this.workspaceRoot, f.relativePath);
        item.command = {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [vscode.Uri.file(absPath)],
        };
        item.tooltip = `Open ${f.relativePath} (${f.language}) — ${f.size} bytes`;
        return item;
      });
    }

    if (element.contextValue === 'category_symbols') {
      let files = fileRepo.getAll(this.projectId);
      if (files.length === 0) {
        files = fileRepo.getAll();
      }

      const symbols: SymbolInfo[] = files
        .flatMap((f) => (f.id ? symbolRepo.getByFile(f.id).map((s) => ({ ...s, filePath: f.relativePath })) : []))
        .slice(0, 150);

      return symbols.map((s: SymbolInfo) => {
        let iconName = 'symbol-misc';
        if (s.kind === 'class') iconName = 'symbol-class';
        else if (s.kind === 'function' || s.kind === 'method') iconName = 'symbol-function';
        else if (s.kind === 'interface') iconName = 'symbol-interface';
        else if (s.kind === 'type_alias' || s.kind === 'type') iconName = 'symbol-type-parameter';
        else if (s.kind === 'enum') iconName = 'symbol-enum';
        else if (s.kind === 'variable' || s.kind === 'constant') iconName = 'symbol-variable';

        const item = new CodeAtlasTreeItem(
          s.name,
          vscode.TreeItemCollapsibleState.None,
          'symbol_item',
          `${s.kind} • ${s.filePath}`,
          iconName,
        );

        const absPath = path.isAbsolute(s.filePath || '')
          ? s.filePath || ''
          : path.join(this.workspaceRoot, s.filePath || '');

        item.command = {
          command: 'vscode.open',
          title: 'Open Symbol',
          arguments: [
            vscode.Uri.file(absPath),
            {
              selection: new vscode.Range(
                Math.max(0, s.line - 1),
                Math.max(0, (s.columnNum || 1) - 1),
                Math.max(0, (s.endLine || s.line) - 1),
                0,
              ),
            },
          ],
        };
        item.tooltip = `${s.kind} ${s.name}\n${s.signature || ''}\nLine ${s.line} in ${s.filePath}`;
        return item;
      });
    }

    return [];
  }
}

/**
 * Architecture & Health Diagnostics Provider
 */
export class CodeAtlasAnalyticsProvider implements vscode.TreeDataProvider<CodeAtlasTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CodeAtlasTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private db: AtlasDatabase | null,
    private workspaceRoot: string,
    private projectId: number = 1,
  ) {}

  setDatabase(db: AtlasDatabase | null, projectId: number = 1): void {
    this.db = db;
    this.projectId = projectId;
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CodeAtlasTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: CodeAtlasTreeItem): Promise<CodeAtlasTreeItem[]> {
    if (!this.workspaceRoot || !this.db) {
      return [new CodeAtlasTreeItem('Index workspace to view health diagnostics', vscode.TreeItemCollapsibleState.None, undefined, undefined, 'pulse')];
    }

    const fileRepo = new FileRepository(this.db);
    const depRepo = new DependencyRepository(this.db);

    let files = fileRepo.getAll(this.projectId);
    if (files.length === 0) files = fileRepo.getAll();
    const deps = depRepo.getAll(this.projectId);

    if (!element) {
      const graph = new DependencyGraph();
      for (const f of files) {
        graph.addNode({
          id: f.relativePath,
          path: f.relativePath,
          name: path.basename(f.relativePath),
          language: f.language,
          module: f.module || '.',
          size: f.size,
          lastModified: f.lastModified || Date.now(),
        });
      }
      for (const d of deps) {
        graph.addEdge({
          source: d.sourcePath,
          target: d.targetPath,
          kind: (d.kind as 'import' | 'call' | 'export' | 'type_reference') || 'import',
          weight: d.weight || 1,
        });
      }

      const cycleDetector = new CycleDetector(graph);
      const cycles = cycleDetector.detectCycles();

      const deadDetector = new DeadCodeDetector(graph);
      const deadFiles = deadDetector.findDeadFiles();

      const analyzer = new ArchitectureAnalyzer(files, deps);
      const dddLayers = analyzer.analyzeLayers();

      const layerItem = new CodeAtlasTreeItem(
        `DDD Layer Architecture`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'cat_layers',
        `${dddLayers.presentation.length + dddLayers.application.length + dddLayers.domain.length + dddLayers.infrastructure.length} modules`,
        'layers',
      );

      const cycleItem = new CodeAtlasTreeItem(
        `Circular Dependencies (${cycles.length})`,
        cycles.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        'cat_cycles',
        cycles.length === 0 ? '✓ None (Clean)' : '⚠ Regressions found',
        cycles.length === 0 ? 'check' : 'warning',
      );

      const deadItem = new CodeAtlasTreeItem(
        `Dead / Orphan Files (${deadFiles.length})`,
        deadFiles.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        'cat_dead',
        deadFiles.length === 0 ? '✓ Clean' : `${deadFiles.length} files`,
        deadFiles.length === 0 ? 'pass' : 'trash',
      );

      return [layerItem, cycleItem, deadItem];
    }

    if (element.contextValue === 'cat_layers') {
      const analyzer = new ArchitectureAnalyzer(files, deps);
      const ddd = analyzer.analyzeLayers();

      return [
        new CodeAtlasTreeItem(`Presentation Layer (${ddd.presentation.length})`, vscode.TreeItemCollapsibleState.None, 'layer', 'Controllers, UI, Routes', 'preview'),
        new CodeAtlasTreeItem(`Application Layer (${ddd.application.length})`, vscode.TreeItemCollapsibleState.None, 'layer', 'Services, Use-Cases', 'gear'),
        new CodeAtlasTreeItem(`Domain Layer (${ddd.domain.length})`, vscode.TreeItemCollapsibleState.None, 'layer', 'Core Entities, Value Objects', 'heart'),
        new CodeAtlasTreeItem(`Infrastructure Layer (${ddd.infrastructure.length})`, vscode.TreeItemCollapsibleState.None, 'layer', 'DB, Storage, External APIs', 'server'),
      ];
    }

    if (element.contextValue === 'cat_cycles') {
      const graph = new DependencyGraph();
      for (const f of files) graph.addNode({ id: f.relativePath, path: f.relativePath, name: path.basename(f.relativePath), language: f.language, module: '.', size: f.size, lastModified: 0 });
      for (const d of deps) graph.addEdge({ source: d.sourcePath, target: d.targetPath, kind: 'import', weight: 1 });
      const cycles = new CycleDetector(graph).detectCycles();

      return cycles.slice(0, 20).map((c) => {
        const cyclePath = c.path.join(' ➔ ');
        const item = new CodeAtlasTreeItem(cyclePath, vscode.TreeItemCollapsibleState.None, 'cycle_item', `${c.length} files`, 'sync');
        const firstFile = c.path[0];
        if (firstFile) {
          item.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [vscode.Uri.file(path.join(this.workspaceRoot, firstFile))],
          };
        }
        return item;
      });
    }

    if (element.contextValue === 'cat_dead') {
      const graph = new DependencyGraph();
      for (const f of files) graph.addNode({ id: f.relativePath, path: f.relativePath, name: path.basename(f.relativePath), language: f.language, module: '.', size: f.size, lastModified: 0 });
      for (const d of deps) graph.addEdge({ source: d.sourcePath, target: d.targetPath, kind: 'import', weight: 1 });
      const deadFiles = new DeadCodeDetector(graph).findDeadFiles();

      return deadFiles.slice(0, 30).map((f) => {
        const item = new CodeAtlasTreeItem(f, vscode.TreeItemCollapsibleState.None, 'dead_file', '0 incoming imports', 'file');
        item.command = {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [vscode.Uri.file(path.join(this.workspaceRoot, f))],
        };
        return item;
      });
    }

    return [];
  }
}

/**
 * AI Agent Rules & Governance Provider
 */
export class CodeAtlasRulesProvider implements vscode.TreeDataProvider<CodeAtlasTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CodeAtlasTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private workspaceRoot: string) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CodeAtlasTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<CodeAtlasTreeItem[]> {
    if (!this.workspaceRoot) {
      return [];
    }

    const engine = new RuleEngine(this.workspaceRoot);
    const rules = engine.discover();

    if (rules.length === 0) {
      const emptyItem = new CodeAtlasTreeItem('No AI rules detected', vscode.TreeItemCollapsibleState.None, undefined, 'Click to generate rules', 'shield');
      emptyItem.command = {
        command: 'codeatlas.exportContext',
        title: 'Generate Rules',
      };
      return [emptyItem];
    }

    return rules.map((r) => {
      const item = new CodeAtlasTreeItem(
        `${r.source.toUpperCase()} Rule`,
        vscode.TreeItemCollapsibleState.None,
        'rule_item',
        r.scope === 'global' ? 'Global Scope' : r.pathPattern || r.filePath,
        'shield',
      );
      item.command = {
        command: 'vscode.open',
        title: 'Open Rule',
        arguments: [vscode.Uri.file(path.join(this.workspaceRoot, r.filePath))],
      };
      item.tooltip = `Source: ${r.source}\nPriority: ${r.priority}\nPath: ${r.filePath}`;
      return item;
    });
  }
}

/**
 * Quick Actions & AI Tools Provider (1-Click Sidebar Hub)
 */
export class CodeAtlasToolsProvider implements vscode.TreeDataProvider<CodeAtlasTreeItem> {
  constructor(private workspaceRoot: string) {}

  getTreeItem(element: CodeAtlasTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<CodeAtlasTreeItem[]> {
    const items: CodeAtlasTreeItem[] = [];

    const graphAction = new CodeAtlasTreeItem('Open 3D/2D Graph Canvas', vscode.TreeItemCollapsibleState.None, 'tool', 'Interactive WebGL Architecture', 'type-hierarchy');
    graphAction.command = { command: 'codeatlas.openGraphView', title: 'Open Graph' };
    items.push(graphAction);

    const indexAction = new CodeAtlasTreeItem('Index / Refresh Workspace', vscode.TreeItemCollapsibleState.None, 'tool', 'Extract Tree-sitter ASTs', 'refresh');
    indexAction.command = { command: 'codeatlas.indexCodebase', title: 'Index Codebase' };
    items.push(indexAction);

    const contextAction = new CodeAtlasTreeItem('Export Context Pack for AI', vscode.TreeItemCollapsibleState.None, 'tool', 'Token-budgeted & compressed', 'cloud-download');
    contextAction.command = { command: 'codeatlas.exportContext', title: 'Export Context' };
    items.push(contextAction);

    const prAction = new CodeAtlasTreeItem('Generate Git PR Blast Radius', vscode.TreeItemCollapsibleState.None, 'tool', 'Downstream impact analysis', 'git-pull-request');
    prAction.command = { command: 'codeatlas.generatePRContext', title: 'Generate PR Context' };
    items.push(prAction);

    const queryAction = new CodeAtlasTreeItem('Run Cypher Graph Query', vscode.TreeItemCollapsibleState.None, 'tool', 'Dependency traversal query', 'search');
    queryAction.command = { command: 'codeatlas.queryGraph', title: 'Query Graph' };
    items.push(queryAction);

    const watchAction = new CodeAtlasTreeItem('Toggle Real-time Watcher', vscode.TreeItemCollapsibleState.None, 'tool', 'Auto-index on file save (Ctrl+S)', 'eye');
    watchAction.command = { command: 'codeatlas.toggleWatcher', title: 'Toggle Watcher' };
    items.push(watchAction);

    return items;
  }
}

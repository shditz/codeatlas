import * as vscode from 'vscode';
import type { AtlasDatabase } from '@codeatlas/storage';
import type { FileInfo, SymbolInfo } from '@codeatlas/core';
import { FileRepository, SymbolRepository } from '@codeatlas/storage';
import { RuleEngine } from '@codeatlas/rules';

export class CodeAtlasTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue?: string,
    public readonly description?: string,
  ) {
    super(label, collapsibleState);
    this.description = description;
  }
}

export class CodeAtlasOverviewProvider implements vscode.TreeDataProvider<CodeAtlasTreeItem> {
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
    if (!this.workspaceRoot) {
      return [new CodeAtlasTreeItem('No workspace opened', vscode.TreeItemCollapsibleState.None)];
    }

    if (!this.db) {
      return [
        new CodeAtlasTreeItem('CodeAtlas not indexed', vscode.TreeItemCollapsibleState.None, 'not_indexed', 'Click to index'),
      ];
    }

    const fileRepo = new FileRepository(this.db);
    const symbolRepo = new SymbolRepository(this.db);

    if (!element) {
      // Root items
      const fileCount = fileRepo.count(this.projectId);
      const symbolCount = symbolRepo.count();

      return [
        new CodeAtlasTreeItem(`📁 Files (${fileCount})`, vscode.TreeItemCollapsibleState.Collapsed, 'category_files'),
        new CodeAtlasTreeItem(`🔣 Symbols (${symbolCount})`, vscode.TreeItemCollapsibleState.Collapsed, 'category_symbols'),
      ];
    }

    if (element.contextValue === 'category_files') {
      const files: FileInfo[] = fileRepo.getAll(this.projectId).slice(0, 50);
      return files.map(
        (f) =>
          new CodeAtlasTreeItem(
            f.relativePath,
            vscode.TreeItemCollapsibleState.None,
            'file_item',
            `[${f.language}]`,
          ),
      );
    }

    if (element.contextValue === 'category_symbols') {
      const files = fileRepo.getAll(this.projectId);
      const symbols: SymbolInfo[] = files
        .flatMap((f) => (f.id ? symbolRepo.getByFile(f.id).map((s) => ({ ...s, filePath: f.relativePath })) : []))
        .slice(0, 50);
      return symbols.map(
        (s: SymbolInfo) =>
          new CodeAtlasTreeItem(
            `${s.name} (${s.kind})`,
            vscode.TreeItemCollapsibleState.None,
            'symbol_item',
            s.filePath,
          ),
      );
    }

    return [];
  }
}

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
      return [new CodeAtlasTreeItem('No AI rules detected', vscode.TreeItemCollapsibleState.None)];
    }

    return rules.map(
      (r) =>
        new CodeAtlasTreeItem(
          `${r.source.toUpperCase()} Rule`,
          vscode.TreeItemCollapsibleState.None,
          'rule_item',
          r.filePath,
        ),
    );
  }
}

import * as vscode from 'vscode';
import path from 'node:path';
import type { AtlasDatabase } from '@codeatlas-ai/storage';
import { FileRepository, SymbolRepository, DependencyRepository } from '@codeatlas-ai/storage';
import { DependencyGraph } from '@codeatlas-ai/graph';
import { normalizePath } from '@codeatlas-ai/shared';

export class CodeAtlasCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private fileRepo: FileRepository | null = null;
  private symbolRepo: SymbolRepository | null = null;
  private depRepo: DependencyRepository | null = null;
  private graph: DependencyGraph | null = null;

  constructor(
    private db: AtlasDatabase | null,
    private workspaceRoot: string,
    private projectId: number = 1,
  ) {
    this.updateRepos();
  }

  setDatabase(db: AtlasDatabase | null, projectId: number = 1): void {
    this.db = db;
    this.projectId = projectId;
    this.updateRepos();
    this.refresh();
  }

  private updateRepos(): void {
    if (this.db) {
      this.fileRepo = new FileRepository(this.db);
      this.symbolRepo = new SymbolRepository(this.db);
      this.depRepo = new DependencyRepository(this.db);
      try {
        const deps = this.depRepo.getAll(this.projectId);
        this.graph = new DependencyGraph();
        this.graph.addEdges(deps);
      } catch {
        this.graph = null;
      }
    } else {
      this.fileRepo = null;
      this.symbolRepo = null;
      this.depRepo = null;
      this.graph = null;
    }
  }

  refresh(): void {
    this.updateRepos();
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.CodeLens[] {
    if (!this.db || !this.fileRepo || !this.symbolRepo || !this.workspaceRoot) {
      return [];
    }

    const relativePath = normalizePath(path.relative(this.workspaceRoot, document.uri.fsPath));
    const file = this.fileRepo.getByPath(this.projectId, relativePath);
    if (!file || !file.id) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];

    const incomingDeps = this.depRepo
      ? this.depRepo.getDependents(this.projectId, relativePath)
      : [];
    const outgoingDeps = this.depRepo
      ? this.depRepo.getDependencies(this.projectId, relativePath)
      : [];
    let pageRankStr = '';
    if (this.graph) {
      try {
        const pageRank = this.graph.getPageRank(relativePath);
        if (pageRank !== undefined && pageRank > 0) {
          pageRankStr = ` | PageRank: ${pageRank.toFixed(3)}`;
        }
      } catch {
        // ignore graph error
      }
    }

    const fileRange = new vscode.Range(0, 0, 0, 0);
    lenses.push(
      new vscode.CodeLens(fileRange, {
        title: `CodeAtlas: ⬆ ${incomingDeps.length} incoming | ⬇ ${outgoingDeps.length} imports${pageRankStr}`,
        command: 'codeatlas.focusInGraph',
        arguments: [relativePath],
        tooltip: 'Click to focus this file and view its blast radius in Architecture Graph',
      }),
      new vscode.CodeLens(fileRange, {
        title: `🔍 Explain Architecture Graph`,
        command: 'codeatlas.focusInGraph',
        arguments: [relativePath],
        tooltip: 'Open interactive 3D/2D architecture visualization focused on this file',
      }),
    );

    const symbols = this.symbolRepo.getByFile(file.id);
    for (const sym of symbols) {
      if (sym.line > 0 && sym.line <= document.lineCount) {
        const lineIdx = sym.line - 1;
        const lineText = document.lineAt(lineIdx).text;
        const firstNonWhitespace = document.lineAt(lineIdx).firstNonWhitespaceCharacterIndex;
        const range = new vscode.Range(lineIdx, firstNonWhitespace, lineIdx, lineText.length);

        let refCount = 0;
        for (const inc of incomingDeps) {
          if (inc.symbols && Array.isArray(inc.symbols) && inc.symbols.includes(sym.name)) {
            refCount++;
          }
        }

        const title =
          refCount > 0
            ? `◆ ${sym.kind}: ${sym.name} (${refCount} reference${refCount > 1 ? 's' : ''})`
            : `◆ ${sym.kind}: ${sym.name}${sym.exported ? ' (exported)' : ''}`;

        lenses.push(
          new vscode.CodeLens(range, {
            title,
            command: 'codeatlas.focusInGraph',
            arguments: [relativePath, sym.name],
            tooltip: `Kind: ${sym.kind}, Exported: ${Boolean(sym.exported)} - Click to focus in graph`,
          }),
        );

        if (
          [
            'class',
            'function',
            'method',
            'interface',
            'struct',
            'controller',
            'route_handler',
            'model',
            'module',
          ].includes(sym.kind)
        ) {
          lenses.push(
            new vscode.CodeLens(range, {
              title: `⚡ Explain with Graph`,
              command: 'codeatlas.focusInGraph',
              arguments: [relativePath, sym.name],
              tooltip: `Visualize call graph, callers, and architectural context for ${sym.name}`,
            }),
          );
        }
      }
    }

    return lenses;
  }
}

import type { DependencyGraph } from '@codeatlas/graph';
import type { FileInfo, SymbolInfo, DeadCodeItem } from '@codeatlas/core';

export interface DeadCodeDetectorOptions {
  entryPatterns?: RegExp[];
  ignoreTestFiles?: boolean;
  ignoreGeneratedFiles?: boolean;
}

const DEFAULT_ENTRY_PATTERNS = [
  /index\.[a-z0-9]+$/i,
  /main\.[a-z0-9]+$/i,
  /app\.[a-z0-9]+$/i,
  /server\.[a-z0-9]+$/i,
  /cli\.[a-z0-9]+$/i,
  /bin\.[a-z0-9]+$/i,
  /\.config\.[a-z0-9]+$/i,
  /rc\.[a-z0-9]+$/i,
  /\.d\.ts$/i,
];

export class DeadCodeDetector {
  private graph: DependencyGraph;
  private files: FileInfo[];
  private symbols: SymbolInfo[];
  private entryPatterns: RegExp[];
  private ignoreTestFiles: boolean;
  private ignoreGeneratedFiles: boolean;

  constructor(
    graph: DependencyGraph,
    files: FileInfo[] = [],
    symbols: SymbolInfo[] = [],
    options?: DeadCodeDetectorOptions,
  ) {
    this.graph = graph;
    this.files = files;
    this.symbols = symbols;
    this.entryPatterns = options?.entryPatterns ?? DEFAULT_ENTRY_PATTERNS;
    this.ignoreTestFiles = options?.ignoreTestFiles ?? true;
    this.ignoreGeneratedFiles = options?.ignoreGeneratedFiles ?? true;
  }

  detectDeadCode(): DeadCodeItem[] {
    const deadItems: DeadCodeItem[] = [];

    const nonCodeLangs = new Set([
      'markdown',
      'yaml',
      'toml',
      'json',
      'html',
      'css',
      'scss',
      'unknown',
      'dockerfile',
      'shell',
    ]);
    for (const file of this.files) {
      if (this.ignoreTestFiles && file.isTest) continue;
      if (this.ignoreGeneratedFiles && file.isGenerated) continue;
      if (nonCodeLangs.has(file.language.toLowerCase())) continue;
      if (this.isEntryPoint(file.relativePath)) continue;

      const inEdges = [
        ...this.graph.getDirectDependents(file.relativePath),
        ...this.graph.getDirectDependents(file.path),
      ];
      if (inEdges.length === 0) {
        deadItems.push({
          id: file.relativePath,
          name: file.relativePath.split('/').pop() || file.relativePath,
          kind: 'file',
          filePath: file.relativePath,
          reason: 'No incoming dependencies or imports found from other files in the codebase.',
        });
      }
    }

    if (this.symbols.length > 0) {
      const referencedSymbols = new Set<string>();

      for (const node of this.graph.getAllNodes()) {
        const outDeps = this.graph.getDirectDependencies(node);
        for (const dep of outDeps) {
          for (const sym of dep.symbols) {
            referencedSymbols.add(sym);
          }
        }
      }

      for (const sym of this.symbols) {
        if (sym.exported && !referencedSymbols.has(sym.name)) {
          if (!this.isEntryPoint(sym.filePath)) {
            deadItems.push({
              id: `${sym.filePath}:${sym.name}`,
              name: sym.name,
              kind: 'symbol',
              filePath: sym.filePath,
              line: sym.line,
              reason: `Exported symbol '${sym.name}' (${sym.kind}) is not imported anywhere across known dependencies.`,
            });
          }
        }
      }
    }

    return deadItems;
  }

  private isEntryPoint(path: string): boolean {
    const normalized = path.replace(/\\/g, '/');
    return this.entryPatterns.some((p) => p.test(normalized));
  }
}

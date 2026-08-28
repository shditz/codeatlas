import type { AtlasDatabase } from './database.js';

export interface FtsResult {
  rowid: number;
  relativePath: string;
  rank: number;
  snippet: string;
}

export class SearchRepository {
  constructor(private db: AtlasDatabase) {}

  indexFile(fileId: number, relativePath: string, content: string): void {
    this.db.run(
      'INSERT INTO files_fts(rowid, relative_path, content) VALUES (?, ?, ?)',
      fileId,
      relativePath,
      content,
    );
  }

  removeFile(fileId: number): void {
    try {
      this.db.run(
        "INSERT INTO files_fts(files_fts, rowid, relative_path, content) VALUES ('delete', ?, '', '')",
        fileId,
      );
    } catch {
      // Ignore if FTS entry doesn't exist
    }
  }

  indexSymbol(symbolId: number, name: string, signature: string | null): void {
    this.db.run(
      'INSERT INTO symbols_fts(rowid, name, signature) VALUES (?, ?, ?)',
      symbolId,
      name,
      signature ?? '',
    );
  }

  removeSymbol(symbolId: number): void {
    try {
      this.db.run('DELETE FROM symbols_fts WHERE rowid = ?', symbolId);
    } catch {
      // Ignore if FTS entry doesn't exist
    }
  }

  searchFiles(query: string, limit: number = 50): FtsResult[] {
    const sanitized = this.sanitizeQuery(query);
    if (!sanitized) return [];

    const rows = this.db.all<{
      rowid: number;
      relative_path: string;
      rank: number;
      snippet: string;
    }>(
      `SELECT f.id as rowid, f.relative_path, rank, snippet(files_fts, 1, '<b>', '</b>', '...', 32) as snippet
       FROM files_fts
       JOIN files f ON f.id = files_fts.rowid
       WHERE files_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
      sanitized,
      limit,
    );

    return rows.map((r) => ({
      rowid: r.rowid,
      relativePath: r.relative_path,
      rank: r.rank,
      snippet: r.snippet,
    }));
  }

  searchSymbols(
    query: string,
    limit: number = 50,
  ): Array<{ file_id: number; relativePath: string; rank: number }> {
    const sanitized = this.sanitizeQuery(query);
    if (!sanitized) return [];

    const rows = this.db.all<{ file_id: number; relative_path: string; rank: number }>(
      `SELECT s.file_id, f.relative_path, rank
       FROM symbols_fts
       JOIN symbols s ON s.id = symbols_fts.rowid
       JOIN files f ON f.id = s.file_id
       WHERE symbols_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
      sanitized,
      limit,
    );

    return rows.map((r) => ({
      file_id: r.file_id,
      relativePath: r.relative_path,
      rank: r.rank,
    }));
  }

  rebuildIndex(): void {
    this.db.run("INSERT INTO files_fts(files_fts) VALUES('rebuild')");
    this.db.run("INSERT INTO symbols_fts(symbols_fts) VALUES('rebuild')");
  }

  /**
   * Reciprocal Rank Fusion (RRF) — combines BM25 text results with
   * pre-scored vector results into a single unified ranking.
   * Formula: RRF(d) = Σ 1/(k + rank_i(d))  where k=60 (standard constant).
   */
  hybridSearch(
    query: string,
    vectorResults: Array<{ relativePath: string; score: number }>,
    limit: number = 30,
    k: number = 60,
  ): Array<{ relativePath: string; rrfScore: number; ftsRank: number; vectorRank: number }> {
    // 1. Get BM25 FTS results
    const ftsResults = this.searchFiles(query, limit * 2);

    // 2. Build rank maps (1-indexed)
    const ftsRankMap = new Map<string, number>();
    ftsResults.forEach((r, i) => ftsRankMap.set(r.relativePath, i + 1));

    const vecRankMap = new Map<string, number>();
    vectorResults.forEach((r, i) => vecRankMap.set(r.relativePath, i + 1));

    // 3. Union all candidate file paths
    const allPaths = new Set<string>([
      ...ftsResults.map((r) => r.relativePath),
      ...vectorResults.map((r) => r.relativePath),
    ]);

    // 4. Compute RRF score
    const scored: Array<{
      relativePath: string;
      rrfScore: number;
      ftsRank: number;
      vectorRank: number;
    }> = [];

    for (const filePath of allPaths) {
      const ftsRank = ftsRankMap.get(filePath) ?? limit * 3;
      const vecRank = vecRankMap.get(filePath) ?? limit * 3;
      const rrfScore = 1 / (k + ftsRank) + 1 / (k + vecRank);

      scored.push({
        relativePath: filePath,
        rrfScore,
        ftsRank,
        vectorRank: vecRank,
      });
    }

    // 5. Sort by descending RRF score and return top N
    scored.sort((a, b) => b.rrfScore - a.rrfScore);
    return scored.slice(0, limit);
  }

  private expandQuery(terms: string[]): string[] {
    const synonyms: Record<string, string[]> = {
      network: ['api', 'http', 'fetch', 'request', 'axios'],
      db: ['database', 'sqlite', 'sql', 'query', 'storage'],
      ui: ['view', 'component', 'render', 'react', 'dom'],
      error: ['exception', 'catch', 'fail', 'crash', 'bug'],
      test: ['spec', 'mock', 'assert', 'jest'],
      config: ['settings', 'env', 'options', 'setup', 'toml', 'json'],
      auth: ['login', 'token', 'jwt', 'session', 'security'],
      graph: ['node', 'edge', 'dependency', 'tree', 'ast'],
    };

    const expanded = new Set<string>();
    for (const term of terms) {
      const lower = term.toLowerCase();
      expanded.add(lower);
      if (synonyms[lower]) {
        for (const syn of synonyms[lower]) {
          expanded.add(syn);
        }
      }
    }
    return Array.from(expanded);
  }

  private sanitizeQuery(query: string): string {
    const rawTerms = query
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 0);

    if (rawTerms.length === 0) return '""';

    const expandedTerms = this.expandQuery(rawTerms);

    // Use prefix matching (term*) for fuzzy matching in FTS5
    return expandedTerms.map((term) => `"${term}"*`).join(' OR ');
  }
}

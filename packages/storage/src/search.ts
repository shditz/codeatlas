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
    this.db.run(
      "INSERT INTO files_fts(files_fts, rowid, relative_path, content) VALUES ('delete', ?, '', '')",
      fileId,
    );
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
    this.db.run(
      "INSERT INTO symbols_fts(symbols_fts, rowid, name, signature) VALUES ('delete', ?, '', '')",
      symbolId,
    );
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

  searchSymbols(query: string, limit: number = 50): Array<{ rowid: number; rank: number }> {
    const sanitized = this.sanitizeQuery(query);
    if (!sanitized) return [];

    return this.db.all<{ rowid: number; rank: number }>(
      `SELECT rowid, rank
       FROM symbols_fts
       WHERE symbols_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
      sanitized,
      limit,
    );
  }

  rebuildIndex(): void {
    this.db.run("INSERT INTO files_fts(files_fts) VALUES('rebuild')");
    this.db.run("INSERT INTO symbols_fts(symbols_fts) VALUES('rebuild')");
  }

  private sanitizeQuery(query: string): string {
    return query
      .replace(/[^\w\s-_.]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => `"${term}"`)
      .join(' OR ');
  }
}

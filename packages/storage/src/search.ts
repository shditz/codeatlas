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

  private sanitizeQuery(query: string): string {
    const sanitized = query
      .replace(/[^\w\s]/g, ' ') 
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => `"${term}"`)
      .join(' OR ');

    return sanitized || '""';
  }
}

import type { AtlasDatabase } from './database.js';
import type { FileInfo, SymbolInfo, ImportInfo, DependencyEdge } from '@codeatlas/core';

export class FileRepository {
  constructor(private db: AtlasDatabase) {}

  upsert(projectId: number, file: FileInfo): number {
    this.db.run(
      `INSERT INTO files (project_id, path, relative_path, extension, language, size, hash, module, is_test, is_generated, symbol_count, import_count, export_count, content, last_modified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, relative_path)
       DO UPDATE SET path=excluded.path, extension=excluded.extension, language=excluded.language, size=excluded.size, hash=excluded.hash, module=excluded.module, is_test=excluded.is_test, is_generated=excluded.is_generated, symbol_count=excluded.symbol_count, import_count=excluded.import_count, export_count=excluded.export_count, content=excluded.content, last_modified=excluded.last_modified, indexed_at=datetime('now')`,
      projectId,
      file.path,
      file.relativePath,
      file.extension,
      file.language,
      file.size,
      file.hash,
      file.module,
      file.isTest ? 1 : 0,
      file.isGenerated ? 1 : 0,
      file.symbolCount,
      file.importCount,
      file.exportCount,
      null,
      file.lastModified ?? null,
    );
    // Query the actual row id — lastInsertRowid is unreliable for ON CONFLICT DO UPDATE
    const row = this.db.get<{ id: number }>(
      'SELECT id FROM files WHERE project_id = ? AND relative_path = ?',
      projectId,
      file.relativePath,
    );
    return row?.id ?? 0;
  }

  getByPath(projectId: number, relativePath: string): FileInfo | undefined {
    const row = this.db.get<Record<string, unknown>>(
      'SELECT * FROM files WHERE project_id = ? AND relative_path = ?',
      projectId,
      relativePath,
    );
    return row ? this.mapRow(row) : undefined;
  }

  getAll(projectId: number): FileInfo[] {
    const rows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM files WHERE project_id = ?',
      projectId,
    );
    return rows.map((r) => this.mapRow(r));
  }

  getByLanguage(projectId: number, language: string): FileInfo[] {
    const rows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM files WHERE project_id = ? AND language = ?',
      projectId,
      language,
    );
    return rows.map((r) => this.mapRow(r));
  }

  getHash(projectId: number, relativePath: string): string | undefined {
    const row = this.db.get<{ hash: string }>(
      'SELECT hash FROM files WHERE project_id = ? AND relative_path = ?',
      projectId,
      relativePath,
    );
    return row?.hash;
  }

  getAllHashes(projectId: number): Map<string, string> {
    const rows = this.db.all<{ relative_path: string; hash: string }>(
      'SELECT relative_path, hash FROM files WHERE project_id = ?',
      projectId,
    );
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.relative_path, row.hash);
    }
    return map;
  }

  delete(projectId: number, relativePath: string): void {
    this.db.run(
      'DELETE FROM files WHERE project_id = ? AND relative_path = ?',
      projectId,
      relativePath,
    );
  }

  deleteAll(projectId: number): void {
    this.db.run('DELETE FROM files WHERE project_id = ?', projectId);
  }

  count(projectId: number): number {
    const row = this.db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM files WHERE project_id = ?',
      projectId,
    );
    return row?.count ?? 0;
  }

  private mapRow(row: Record<string, unknown>): FileInfo {
    return {
      id: row['id'] as number,
      path: row['path'] as string,
      relativePath: row['relative_path'] as string,
      extension: row['extension'] as string,
      language: row['language'] as FileInfo['language'],
      size: row['size'] as number,
      hash: row['hash'] as string,
      module: row['module'] as string,
      isTest: (row['is_test'] as number) === 1,
      isGenerated: (row['is_generated'] as number) === 1,
      symbolCount: row['symbol_count'] as number,
      importCount: row['import_count'] as number,
      exportCount: row['export_count'] as number,
      lastModified: row['last_modified'] as number | undefined,
    };
  }
}

export class SymbolRepository {
  constructor(private db: AtlasDatabase) {}

  insertBatch(fileId: number, symbols: SymbolInfo[]): void {
    const stmt = this.db.instance.prepare(
      `INSERT INTO symbols (file_id, name, kind, line, end_line, column_num, exported, signature, parent_symbol)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    this.db.transaction(() => {
      for (const sym of symbols) {
        stmt.run(
          fileId,
          sym.name,
          sym.kind,
          sym.line,
          sym.endLine ?? null,
          sym.column,
          sym.exported ? 1 : 0,
          sym.signature ?? null,
          sym.parentSymbol ?? null,
        );
      }
    });
  }

  getByFile(fileId: number): SymbolInfo[] {
    const rows = this.db.all<Record<string, unknown>>(
      'SELECT symbols.*, files.relative_path as file_path FROM symbols JOIN files ON symbols.file_id = files.id WHERE symbols.file_id = ?',
      fileId,
    );
    return rows.map((r) => this.mapRow(r));
  }

  searchByName(name: string): SymbolInfo[] {
    const rows = this.db.all<Record<string, unknown>>(
      'SELECT symbols.*, files.relative_path as file_path FROM symbols JOIN files ON symbols.file_id = files.id WHERE symbols.name LIKE ?',
      `%${name}%`,
    );
    return rows.map((r) => this.mapRow(r));
  }

  deleteByFile(fileId: number): void {
    // Clean up FTS entries safely
    const symbols = this.getByFile(fileId);
    for (const sym of symbols) {
      try {
        this.db.run('DELETE FROM symbols_fts WHERE rowid = ?', sym.id);
      } catch {
        // Ignore missing FTS entries
      }
    }
    
    this.db.run('DELETE FROM symbols WHERE file_id = ?', fileId);
  }

  count(fileId?: number): number {
    if (fileId !== undefined) {
      const row = this.db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM symbols WHERE file_id = ?',
        fileId,
      );
      return row?.count ?? 0;
    }
    const row = this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM symbols');
    return row?.count ?? 0;
  }

  countByProject(projectId: number): number {
    const row = this.db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM symbols WHERE file_id IN (SELECT id FROM files WHERE project_id = ?)',
      projectId,
    );
    return row?.count ?? 0;
  }

  private mapRow(row: Record<string, unknown>): SymbolInfo {
    return {
      id: row['id'] as number,
      name: row['name'] as string,
      kind: row['kind'] as SymbolInfo['kind'],
      filePath: (row['file_path'] as string) ?? '',
      line: row['line'] as number,
      endLine: row['end_line'] as number | undefined,
      column: row['column_num'] as number,
      exported: (row['exported'] as number) === 1,
      signature: row['signature'] as string | undefined,
      parentSymbol: row['parent_symbol'] as string | undefined,
    };
  }
}

export class ImportRepository {
  constructor(private db: AtlasDatabase) {}

  insertBatch(fileId: number, imports: ImportInfo[]): void {
    const stmt = this.db.instance.prepare(
      `INSERT INTO imports (file_id, import_path, resolved_path, symbols, is_default, is_namespace, is_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    this.db.transaction(() => {
      for (const imp of imports) {
        stmt.run(
          fileId,
          imp.importPath,
          imp.resolvedPath ?? null,
          JSON.stringify(imp.symbols),
          imp.isDefault ? 1 : 0,
          imp.isNamespace ? 1 : 0,
          imp.isType ? 1 : 0,
        );
      }
    });
  }

  getByFile(fileId: number): ImportInfo[] {
    const rows = this.db.all<Record<string, unknown>>(
      'SELECT imports.*, files.relative_path as file_path FROM imports JOIN files ON imports.file_id = files.id WHERE imports.file_id = ?',
      fileId,
    );
    return rows.map((r) => this.mapRow(r));
  }

  deleteByFile(fileId: number): void {
    this.db.run('DELETE FROM imports WHERE file_id = ?', fileId);
  }

  private mapRow(row: Record<string, unknown>): ImportInfo {
    return {
      id: row['id'] as number,
      filePath: (row['file_path'] as string) ?? '',
      importPath: row['import_path'] as string,
      resolvedPath: row['resolved_path'] as string | undefined,
      symbols: JSON.parse(row['symbols'] as string) as string[],
      isDefault: (row['is_default'] as number) === 1,
      isNamespace: (row['is_namespace'] as number) === 1,
      isType: (row['is_type'] as number) === 1,
    };
  }
}

export class DependencyRepository {
  constructor(private db: AtlasDatabase) {}

  upsert(projectId: number, edge: DependencyEdge): void {
    this.db.run(
      `INSERT INTO dependencies (project_id, source_path, target_path, kind, symbols, weight)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
      projectId,
      edge.source,
      edge.target,
      edge.kind,
      JSON.stringify(edge.symbols),
      edge.weight,
    );
  }

  insertBatch(projectId: number, edges: DependencyEdge[]): void {
    const stmt = this.db.instance.prepare(
      `INSERT OR IGNORE INTO dependencies (project_id, source_path, target_path, kind, symbols, weight)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    this.db.transaction(() => {
      for (const edge of edges) {
        stmt.run(
          projectId,
          edge.source,
          edge.target,
          edge.kind,
          JSON.stringify(edge.symbols),
          edge.weight,
        );
      }
    });
  }

  getDependencies(projectId: number, sourcePath: string): DependencyEdge[] {
    const rows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM dependencies WHERE project_id = ? AND source_path = ?',
      projectId,
      sourcePath,
    );
    return rows.map((r) => this.mapRow(r));
  }

  getDependents(projectId: number, targetPath: string): DependencyEdge[] {
    const rows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM dependencies WHERE project_id = ? AND target_path = ?',
      projectId,
      targetPath,
    );
    return rows.map((r) => this.mapRow(r));
  }

  getAll(projectId: number): DependencyEdge[] {
    const rows = this.db.all<Record<string, unknown>>(
      'SELECT * FROM dependencies WHERE project_id = ?',
      projectId,
    );
    return rows.map((r) => this.mapRow(r));
  }

  deleteAll(projectId: number): void {
    this.db.run('DELETE FROM dependencies WHERE project_id = ?', projectId);
  }

  count(projectId: number): number {
    const row = this.db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM dependencies WHERE project_id = ?',
      projectId,
    );
    return row?.count ?? 0;
  }

  private mapRow(row: Record<string, unknown>): DependencyEdge {
    return {
      source: row['source_path'] as string,
      target: row['target_path'] as string,
      kind: row['kind'] as DependencyEdge['kind'],
      symbols: JSON.parse(row['symbols'] as string) as string[],
      weight: row['weight'] as number,
    };
  }
}

export interface ProjectRecord {
  id: number;
  name: string;
  root: string;
  packageManager: string;
  isMonorepo: boolean;
  languages: string[];
  frameworks: string[];
  workspaces: string[];
}

export class ProjectRepository {
  constructor(private db: AtlasDatabase) {}

  getOrCreate(root: string, name?: string): { id: number; name: string; root: string } {
    const normalizedRoot = root.replace(/\\/g, '/');
    const existing = this.db.get<{ id: number; name: string; root: string }>(
      'SELECT id, name, root FROM projects WHERE root = ?',
      normalizedRoot,
    );

    if (existing) {
      return existing;
    }

    const projectName = name || normalizedRoot.split('/').pop() || 'project';
    const result = this.db.run(
      'INSERT INTO projects (name, root) VALUES (?, ?)',
      projectName,
      normalizedRoot,
    );
    return {
      id: Number(result.lastInsertRowid),
      name: projectName,
      root: normalizedRoot,
    };
  }

  update(id: number, meta: Partial<ProjectRecord>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (meta.packageManager !== undefined) {
      fields.push('package_manager = ?');
      values.push(meta.packageManager);
    }
    if (meta.isMonorepo !== undefined) {
      fields.push('is_monorepo = ?');
      values.push(meta.isMonorepo ? 1 : 0);
    }
    if (meta.languages !== undefined) {
      fields.push('languages = ?');
      values.push(JSON.stringify(meta.languages));
    }
    if (meta.frameworks !== undefined) {
      fields.push('frameworks = ?');
      values.push(JSON.stringify(meta.frameworks));
    }

    if (fields.length > 0) {
      values.push(id);
      this.db.run(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, ...values);
    }
  }

  getById(id: number): ProjectRecord | undefined {
    const row = this.db.get<Record<string, unknown>>('SELECT * FROM projects WHERE id = ?', id);
    return row ? this.mapRow(row) : undefined;
  }

  getByRoot(root: string): ProjectRecord | undefined {
    const normalized = root.replace(/\\/g, '/');
    const row = this.db.get<Record<string, unknown>>(
      'SELECT * FROM projects WHERE root = ?',
      normalized,
    );
    return row ? this.mapRow(row) : undefined;
  }

  getAll(): ProjectRecord[] {
    const rows = this.db.all<Record<string, unknown>>('SELECT * FROM projects ORDER BY id ASC');
    return rows.map((r) => this.mapRow(r));
  }

  delete(id: number): void {
    this.db.run('DELETE FROM projects WHERE id = ?', id);
  }

  private mapRow(row: Record<string, unknown>): ProjectRecord {
    return {
      id: row['id'] as number,
      name: row['name'] as string,
      root: row['root'] as string,
      packageManager: (row['package_manager'] as string) || 'unknown',
      isMonorepo: (row['is_monorepo'] as number) === 1,
      languages: JSON.parse((row['languages'] as string) || '[]'),
      frameworks: JSON.parse((row['frameworks'] as string) || '[]'),
      workspaces: JSON.parse((row['workspaces'] as string) || '[]'),
    };
  }
}

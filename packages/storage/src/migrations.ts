import type { AtlasDatabase } from './database.js';
import { createLogger } from '@codeatlas/shared';

const logger = createLogger('storage:migrations');

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        root TEXT NOT NULL UNIQUE,
        package_manager TEXT NOT NULL DEFAULT 'unknown',
        is_monorepo INTEGER NOT NULL DEFAULT 0,
        languages TEXT NOT NULL DEFAULT '[]',
        frameworks TEXT NOT NULL DEFAULT '[]',
        workspaces TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        path TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        extension TEXT NOT NULL DEFAULT '',
        language TEXT NOT NULL DEFAULT 'unknown',
        size INTEGER NOT NULL DEFAULT 0,
        hash TEXT NOT NULL DEFAULT '',
        module TEXT NOT NULL DEFAULT '.',
        is_test INTEGER NOT NULL DEFAULT 0,
        is_generated INTEGER NOT NULL DEFAULT 0,
        symbol_count INTEGER NOT NULL DEFAULT 0,
        import_count INTEGER NOT NULL DEFAULT 0,
        export_count INTEGER NOT NULL DEFAULT 0,
        content TEXT,
        last_modified INTEGER,
        indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, relative_path)
      );

      CREATE INDEX IF NOT EXISTS idx_files_language ON files(language);
      CREATE INDEX IF NOT EXISTS idx_files_module ON files(module);
      CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);

      CREATE TABLE IF NOT EXISTS symbols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        line INTEGER NOT NULL,
        end_line INTEGER,
        column_num INTEGER NOT NULL DEFAULT 0,
        exported INTEGER NOT NULL DEFAULT 0,
        signature TEXT,
        parent_symbol TEXT,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
      CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
      CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);

      CREATE TABLE IF NOT EXISTS imports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        import_path TEXT NOT NULL,
        resolved_path TEXT,
        symbols TEXT NOT NULL DEFAULT '[]',
        is_default INTEGER NOT NULL DEFAULT 0,
        is_namespace INTEGER NOT NULL DEFAULT 0,
        is_type INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_imports_file ON imports(file_id);
      CREATE INDEX IF NOT EXISTS idx_imports_resolved ON imports(resolved_path);

      CREATE TABLE IF NOT EXISTS dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        source_path TEXT NOT NULL,
        target_path TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'import',
        symbols TEXT NOT NULL DEFAULT '[]',
        weight REAL NOT NULL DEFAULT 1.0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_deps_source ON dependencies(source_path);
      CREATE INDEX IF NOT EXISTS idx_deps_target ON dependencies(target_path);

      CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        project_id INTEGER NOT NULL,
        source TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'global',
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        path_pattern TEXT,
        agent_target TEXT,
        discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS index_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL UNIQUE,
        last_indexed TEXT NOT NULL DEFAULT (datetime('now')),
        file_count INTEGER NOT NULL DEFAULT 0,
        symbol_count INTEGER NOT NULL DEFAULT 0,
        import_count INTEGER NOT NULL DEFAULT 0,
        version TEXT NOT NULL DEFAULT '0.1.0',
        hash TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        task TEXT NOT NULL,
        context_pack TEXT NOT NULL,
        token_usage INTEGER NOT NULL DEFAULT 0,
        file_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
        relative_path,
        content,
        content='files',
        content_rowid='id',
        tokenize='porter unicode61'
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS symbols_fts USING fts5(
        name,
        signature,
        tokenize='porter unicode61'
      );
    `,
  },
];

export function runMigrations(db: AtlasDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.all<{ version: number }>('SELECT version FROM migrations').map((r) => r.version),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) {
      continue;
    }

    logger.info(`Applying migration ${migration.version}: ${migration.name}`);

    db.transaction(() => {
      db.exec(migration.sql);
      db.run(
        'INSERT INTO migrations (version, name) VALUES (?, ?)',
        migration.version,
        migration.name,
      );
    });
  }
}

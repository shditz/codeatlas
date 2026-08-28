import path from 'node:path';
import fs from 'node:fs';
import { createLogger, StorageError } from '@codeatlas/shared';

const logger = createLogger('storage');

// Native node:sqlite DatabaseSync
interface NativeDatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  close(): void;
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

function getDatabaseSyncConstructor(): new (path: string) => NativeDatabaseSync {
  const mod = (process as any).getBuiltinModule?.('node:sqlite');
  if (mod?.DatabaseSync) {
    return mod.DatabaseSync;
  }
  try {
    const nodeReq = (globalThis as any).require;
    if (nodeReq) return nodeReq('node:sqlite').DatabaseSync;
  } catch {
    // fallback
  }
  throw new Error('node:sqlite is not supported in this Node runtime. CodeAtlas requires Node.js >= 22.0.0');
}

export class AtlasDatabase {
  private db: NativeDatabaseSync;
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;

    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    const DatabaseSync = getDatabaseSyncConstructor();
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');

    logger.debug(`Opened database at ${dbPath}`);
  }

  get instance(): NativeDatabaseSync {
    return this.db;
  }

  run(sql: string, ...params: unknown[]): RunResult {
    try {
      const stmt = this.db.prepare(sql);
      const res = stmt.run(...params);
      return {
        changes: Number(res.changes),
        lastInsertRowid: res.lastInsertRowid,
      };
    } catch (error) {
      throw new StorageError(`SQL execution failed: ${(error as Error).message}`, {
        sql: sql.slice(0, 200),
      });
    }
  }

  get<T = unknown>(sql: string, ...params: unknown[]): T | undefined {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params) as T | undefined;
    } catch (error) {
      throw new StorageError(`SQL query failed: ${(error as Error).message}`, {
        sql: sql.slice(0, 200),
      });
    }
  }

  all<T = unknown>(sql: string, ...params: unknown[]): T[] {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params) as T[];
    } catch (error) {
      throw new StorageError(`SQL query failed: ${(error as Error).message}`, {
        sql: sql.slice(0, 200),
      });
    }
  }

  exec(sql: string): void {
    try {
      this.db.exec(sql);
    } catch (error) {
      throw new StorageError(`SQL exec failed: ${(error as Error).message}`, {
        sql: sql.slice(0, 200),
      });
    }
  }

  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw error;
    }
  }

  close(): void {
    this.db.close();
    logger.debug(`Closed database at ${this.dbPath}`);
  }
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { RepositoryWatcher } from '../index.js';
import { AtlasDatabase, runMigrations } from '@codeatlas-ai/storage';

describe('RepositoryWatcher', () => {
  let tmpDir: string;
  let dbPath: string;
  let db: AtlasDatabase;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-watch-test-'));
    dbPath = path.join(tmpDir, 'test.db');
    db = new AtlasDatabase(dbPath);
    runMigrations(db);
    db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'test', tmpDir.replace(/\\/g, '/'));
  });

  afterEach(() => {
    try {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('initializes and stops without throwing', () => {
    const watcher = new RepositoryWatcher({
      root: tmpDir,
      db,
      projectId: 1,
      debounceMs: 50,
    });

    expect(watcher).toBeDefined();
    watcher.start();
    watcher.stop();
  });
});

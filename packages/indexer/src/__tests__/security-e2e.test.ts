import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  AtlasDatabase,
  runMigrations,
  SearchRepository,
  SymbolRepository,
} from '@codeatlas-ai/storage';
import { Indexer } from '../indexer.js';

describe('P3 End-to-End Security & Framework Integration', () => {
  let tempDir: string;
  let db: AtlasDatabase;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-p3-e2e-'));
    const dbPath = path.join(tempDir, '.atlas.db');
    db = new AtlasDatabase(dbPath);
    runMigrations(db);
  });

  afterEach(() => {
    try {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('redacts secrets before indexing and correctly extracts framework-specific symbols', async () => {
    fs.mkdirSync(path.join(tempDir, 'prisma'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src/hooks'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'app/dashboard'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src/users'), { recursive: true });

    // File containing sensitive secrets
    fs.writeFileSync(
      path.join(tempDir, 'config.ts'),
      'export const SECRET_KEY = "sk-ant-api03-abcdef12345678901234567890";\nexport const DB_URL = "postgres://admin:secretpass123@localhost/db";',
    );

    // Prisma Schema
    fs.writeFileSync(
      path.join(tempDir, 'prisma/schema.prisma'),
      `model Account {
  id Int @id
  user User @relation(fields: [userId], references: [id])
  userId Int
}

model User {
  id Int @id
  accounts Account[]
}`,
    );

    // React Hook
    fs.writeFileSync(
      path.join(tempDir, 'src/hooks/useProfile.ts'),
      'export function useProfile() { return { name: "test" }; }',
    );

    // Next.js App Router
    fs.writeFileSync(
      path.join(tempDir, 'app/dashboard/page.tsx'),
      'export default function DashboardPage() { return <div>Dashboard</div>; }',
    );

    // NestJS Controller
    fs.writeFileSync(
      path.join(tempDir, 'src/users/users.controller.ts'),
      '@Controller("users")\nexport class UsersController {}',
    );

    const projRes = db.run(
      'INSERT INTO projects (name, root) VALUES (?, ?)',
      'test-app',
      tempDir.replace(/\\/g, '/'),
    );
    const projectId = Number(projRes.lastInsertRowid);

    const indexer = new Indexer({
      root: tempDir,
      db,
      projectId,
    });

    const result = await indexer.index();
    expect(result.filesIndexed).toBeGreaterThanOrEqual(4);

    // 1. Verify secrets are never indexed into SQLite FTS
    const searchRepo = new SearchRepository(db);
    const secretResults1 = searchRepo.searchFiles('abcdef1234567890', 10);
    const secretResults2 = searchRepo.searchFiles('secretpass123', 10);
    const redactedResults = searchRepo.searchFiles('REDACTED', 10);

    expect(secretResults1.length).toBe(0);
    expect(secretResults2.length).toBe(0);
    expect(redactedResults.length).toBeGreaterThanOrEqual(1);

    // 2. Verify Framework symbols extracted
    const symbolRepo = new SymbolRepository(db);
    const symbols = symbolRepo.getAllByProject(projectId);

    const hook = symbols.find((s) => s.name === 'useProfile');
    const page = symbols.find((s) => s.name === 'DashboardPage');
    const nest = symbols.find((s) => s.name === 'UsersController');
    const prisma = symbols.find((s) => s.name === 'Account');

    expect(hook?.kind).toBe('hook');
    expect(page?.kind).toBe('page');
    expect(nest?.kind).toBe('controller');
    expect(prisma?.kind).toBe('model');
  });
});

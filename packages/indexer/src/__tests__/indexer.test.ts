import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Scanner, Indexer } from '../index.js';
import {
  AtlasDatabase,
  runMigrations,
  FileRepository,
  SymbolRepository,
  DependencyRepository,
} from '@codeatlas-ai/storage';

describe('Scanner & Indexer Integration', () => {
  let tempDir: string;
  let db: AtlasDatabase;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-index-test-'));
    fs.mkdirSync(path.join(tempDir, 'src', 'auth'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src', 'users'), { recursive: true });

    // Create sample project files
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'demo-app', dependencies: { react: '^18.0.0' } }),
    );

    fs.writeFileSync(
      path.join(tempDir, 'src', 'auth', 'auth.service.ts'),
      `
      import { UserService } from '../users/user.service';

      export interface AuthToken {
        token: string;
      }

      export class AuthService {
        constructor(private userService: UserService) {}

        async login(email: string, password: string): Promise<AuthToken> {
          const user = await this.userService.findByEmail(email);
          return { token: 'jwt-token' };
        }
      }
      `,
    );

    fs.writeFileSync(
      path.join(tempDir, 'src', 'users', 'user.service.ts'),
      `
      export interface User {
        id: string;
        email: string;
      }

      export class UserService {
        async findByEmail(email: string): Promise<User | null> {
          return { id: '1', email };
        }
      }
      `,
    );

    db = new AtlasDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('scans and detects project metadata', async () => {
    const scanner = new Scanner({ root: tempDir });
    const result = await scanner.scan();

    expect(result.detectedFiles).toBeGreaterThanOrEqual(3);
    expect('typescript' in result.detectedLanguages).toBe(true);
    expect('json' in result.detectedLanguages).toBe(true);
    expect(result.detectedFrameworks).toContain('react');
  });

  it('indexes files, extracts AST symbols, and links dependency graph', async () => {
    const projRes = db.run(
      'INSERT INTO projects (name, root) VALUES (?, ?)',
      'demo-app',
      tempDir.replace(/\\/g, '/'),
    );
    const projectId = Number(projRes.lastInsertRowid);

    const indexer = new Indexer({
      root: tempDir,
      db,
      projectId,
    });

    const result = await indexer.index();

    expect(result.filesIndexed).toBeGreaterThanOrEqual(3);
    expect(result.symbolsExtracted).toBeGreaterThanOrEqual(4);
    expect(result.dependenciesCreated).toBeGreaterThanOrEqual(1);

    const fileRepo = new FileRepository(db);
    const symbolRepo = new SymbolRepository(db);
    const depRepo = new DependencyRepository(db);

    const files = fileRepo.getAll(projectId);
    expect(files.length).toBeGreaterThanOrEqual(3);

    const authFile = files.find((f) => f.relativePath.includes('auth.service.ts'));
    expect(authFile).toBeDefined();

    const symbols = symbolRepo.getByFile(authFile!.id!);
    const symbolNames = symbols.map((s) => s.name);
    expect(symbolNames).toContain('AuthService');
    expect(symbolNames).toContain('AuthToken');
    expect(symbolNames).toContain('login');

    const deps = depRepo.getAll(projectId);
    expect(deps.length).toBeGreaterThanOrEqual(1);
    expect(deps[0]?.source).toContain('auth.service.ts');
    expect(deps[0]?.target).toContain('user.service.ts');

    // Test incremental indexing - running again without file changes should skip all files
    const result2 = await indexer.index();
    expect(result2.filesSkipped).toBe(result.filesIndexed);
    expect(result2.filesIndexed).toBe(0);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AtlasDatabase,
  runMigrations,
  FileRepository,
  SymbolRepository,
  DependencyRepository,
  SearchRepository,
  ProjectRepository,
  EmbeddingRepository,
  FederationService,
} from '../index.js';

describe('Storage & SQLite Repositories', () => {
  let db: AtlasDatabase;

  beforeEach(() => {
    db = new AtlasDatabase(':memory:');
    runMigrations(db);
  });

  it('initializes schema and runs migrations idempotently', () => {
    const migrations = db.all<{ version: number }>('SELECT * FROM migrations');
    expect(migrations).toHaveLength(2);
    expect(migrations[0]?.version).toBe(1);
    expect(migrations[1]?.version).toBe(2);

    runMigrations(db);
    const migrations2 = db.all<{ version: number }>('SELECT * FROM migrations');
    expect(migrations2).toHaveLength(2);
  });

  it('performs CRUD operations on files', () => {
    const fileRepo = new FileRepository(db);

    const projRes = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'test', '/test');
    const projectId = Number(projRes.lastInsertRowid);

    const fileId = fileRepo.upsert(projectId, {
      path: '/test/src/auth.ts',
      relativePath: 'src/auth.ts',
      extension: '.ts',
      language: 'typescript',
      size: 512,
      hash: 'abc123hash',
      module: 'src',
      isTest: false,
      isGenerated: false,
      symbolCount: 3,
      importCount: 2,
      exportCount: 1,
    });

    expect(fileId).toBeGreaterThan(0);

    const file = fileRepo.getByPath(projectId, 'src/auth.ts');
    expect(file).toBeDefined();
    expect(file?.relativePath).toBe('src/auth.ts');
    expect(file?.language).toBe('typescript');
    expect(fileRepo.count(projectId)).toBe(1);

    const hashes = fileRepo.getAllHashes(projectId);
    expect(hashes.get('src/auth.ts')).toBe('abc123hash');

    fileRepo.delete(projectId, 'src/auth.ts');
    expect(fileRepo.count(projectId)).toBe(0);
  });

  it('inserts and retrieves symbols', () => {
    const fileRepo = new FileRepository(db);
    const symbolRepo = new SymbolRepository(db);

    const projRes = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'test', '/test');
    const projectId = Number(projRes.lastInsertRowid);

    const fileId = fileRepo.upsert(projectId, {
      path: '/test/src/auth.ts',
      relativePath: 'src/auth.ts',
      extension: '.ts',
      language: 'typescript',
      size: 512,
      hash: 'hash',
      module: 'src',
      isTest: false,
      isGenerated: false,
      symbolCount: 2,
      importCount: 0,
      exportCount: 1,
    });

    symbolRepo.insertBatch(fileId, [
      {
        name: 'AuthService',
        kind: 'class',
        filePath: 'src/auth.ts',
        line: 10,
        column: 0,
        exported: true,
        signature: 'export class AuthService',
      },
      {
        name: 'login',
        kind: 'method',
        filePath: 'src/auth.ts',
        line: 15,
        column: 2,
        exported: false,
        parentSymbol: 'AuthService',
      },
    ]);

    const symbols = symbolRepo.getByFile(fileId);
    expect(symbols).toHaveLength(2);
    expect(symbols[0]?.name).toBe('AuthService');
    expect(symbols[0]?.exported).toBe(true);

    const search = symbolRepo.searchByName('Auth');
    expect(search).toHaveLength(1);
  });

  it('manages dependency graph edges', () => {
    const depRepo = new DependencyRepository(db);

    const projRes = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'test', '/test');
    const projectId = Number(projRes.lastInsertRowid);

    depRepo.insertBatch(projectId, [
      {
        source: 'src/auth.controller.ts',
        target: 'src/auth.service.ts',
        kind: 'import',
        symbols: ['AuthService'],
        weight: 1.0,
      },
      {
        source: 'src/auth.service.ts',
        target: 'src/user.repository.ts',
        kind: 'import',
        symbols: ['UserRepository'],
        weight: 1.0,
      },
    ]);

    expect(depRepo.count(projectId)).toBe(2);

    const deps = depRepo.getDependencies(projectId, 'src/auth.controller.ts');
    expect(deps).toHaveLength(1);
    expect(deps[0]?.target).toBe('src/auth.service.ts');

    const dependents = depRepo.getDependents(projectId, 'src/user.repository.ts');
    expect(dependents).toHaveLength(1);
    expect(dependents[0]?.source).toBe('src/auth.service.ts');
  });

  it('executes FTS5 search correctly', () => {
    const searchRepo = new SearchRepository(db);
    const fileRepo = new FileRepository(db);

    const projRes = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'test', '/test');
    const projectId = Number(projRes.lastInsertRowid);

    const fileId = fileRepo.upsert(projectId, {
      path: '/test/src/auth.service.ts',
      relativePath: 'src/auth.service.ts',
      extension: '.ts',
      language: 'typescript',
      size: 512,
      hash: 'hash',
      module: 'src',
      isTest: false,
      isGenerated: false,
      symbolCount: 1,
      importCount: 0,
      exportCount: 1,
    });

    searchRepo.indexFile(
      fileId,
      'src/auth.service.ts',
      'export class AuthService { async login(email, password) { return oauthLogin(); } }',
    );

    const results = searchRepo.searchFiles('oauthLogin');
    expect(results).toHaveLength(1);
    expect(results[0]?.relativePath).toBe('src/auth.service.ts');
  });

  it('manages multi-project and workspace records with ProjectRepository', () => {
    const projectRepo = new ProjectRepository(db);

    const proj1 = projectRepo.getOrCreate('/workspace/repo-backend', 'backend');
    const proj2 = projectRepo.getOrCreate('/workspace/repo-frontend', 'frontend');
    const proj1Again = projectRepo.getOrCreate('/workspace/repo-backend');

    expect(proj1.id).toBe(proj1Again.id);
    expect(proj1.id).not.toBe(proj2.id);

    const allProjects = projectRepo.getAll();
    expect(allProjects.length).toBeGreaterThanOrEqual(2);

    const fetched = projectRepo.getByRoot('/workspace/repo-backend');
    expect(fetched?.name).toBe('backend');
  });

  it('supports nested transactions correctly with rollback and commit', () => {
    db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'root-proj', '/root');

    db.transaction(() => {
      db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'child-1', '/child-1');

      db.transaction(() => {
        db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'child-2', '/child-2');
      });

      try {
        db.transaction(() => {
          db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'child-3', '/child-3');
          throw new Error('Rollback nested');
        });
      } catch {
        // Expected error caught
      }
    });

    const projects = db.all<{ name: string }>('SELECT name FROM projects');
    const names = projects.map((p) => p.name);

    expect(names).toContain('root-proj');
    expect(names).toContain('child-1');
    expect(names).toContain('child-2');
    expect(names).not.toContain('child-3');
  });

  it('manages vector embeddings with EmbeddingRepository', () => {
    const embeddingRepo = new EmbeddingRepository(db);

    const projRes = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'test-vec', '/vec');
    const projectId = Number(projRes.lastInsertRowid);

    embeddingRepo.upsert({
      projectId,
      filePath: 'src/auth.service.ts',
      symbolName: 'AuthService',
      embedding: [0.1, 0.2, 0.3],
      dimensions: 3,
      model: 'local-heuristic',
    });

    expect(embeddingRepo.count(projectId)).toBe(1);

    const all = embeddingRepo.getAll(projectId);
    expect(all).toHaveLength(1);
    expect(all[0]?.filePath).toBe('src/auth.service.ts');
    expect(all[0]?.symbolName).toBe('AuthService');
    expect(all[0]?.embedding).toEqual([0.1, 0.2, 0.3]);

    embeddingRepo.deleteByFile(projectId, 'src/auth.service.ts');
    expect(embeddingRepo.count(projectId)).toBe(0);
  });

  it('federates cross-repository databases with FederationService', () => {
    const federation = new FederationService(db);
    const attached = federation.listFederated();
    expect(attached.length).toBeGreaterThanOrEqual(1);
    expect(attached[0]?.name).toBe('main');

    const results = federation.searchCrossRepoSymbols('Auth');
    expect(Array.isArray(results)).toBe(true);
  });
});

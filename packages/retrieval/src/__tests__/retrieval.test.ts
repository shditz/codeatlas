import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RetrievalEngine } from '../index.js';
import { AtlasDatabase, runMigrations, FileRepository, SearchRepository } from '@codeatlas/storage';
import { DependencyGraph } from '@codeatlas/graph';
import type { FileInfo } from '@codeatlas/core';

describe('Multi-source Retrieval Engine', () => {
  let db: AtlasDatabase;

  beforeEach(() => {
    db = new AtlasDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('retrieves relevant files across FTS, path, and graph expansion', () => {
    const fileRepo = new FileRepository(db);
    const searchRepo = new SearchRepository(db);

    const projRes = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'test-app', '/test');
    const projectId = Number(projRes.lastInsertRowid);

    const authFileId = fileRepo.upsert(projectId, {
      path: '/test/src/auth/auth.service.ts',
      relativePath: 'src/auth/auth.service.ts',
      extension: '.ts',
      language: 'typescript',
      size: 500,
      hash: 'h1',
      module: 'src/auth',
      isTest: false,
      isGenerated: false,
      symbolCount: 2,
      importCount: 1,
      exportCount: 1,
    });

    const userFileId = fileRepo.upsert(projectId, {
      path: '/test/src/users/user.service.ts',
      relativePath: 'src/users/user.service.ts',
      extension: '.ts',
      language: 'typescript',
      size: 500,
      hash: 'h2',
      module: 'src/users',
      isTest: false,
      isGenerated: false,
      symbolCount: 2,
      importCount: 0,
      exportCount: 1,
    });

    searchRepo.indexFile(
      authFileId,
      'src/auth/auth.service.ts',
      'OAuth login with Google authentication provider',
    );
    searchRepo.indexFile(userFileId, 'src/users/user.service.ts', 'User repository entity store');

    const graph = new DependencyGraph();
    graph.addEdge({
      source: 'src/auth/auth.service.ts',
      target: 'src/users/user.service.ts',
      kind: 'import',
      symbols: ['UserService'],
      weight: 1.0,
    });

    const files = fileRepo.getAll(projectId);
    const filesByPath = new Map<string, FileInfo>(files.map((f) => [f.relativePath, f]));

    const retrieval = new RetrievalEngine(searchRepo, graph, filesByPath);
    const result = retrieval.retrieve('Google OAuth login');

    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    expect(result.candidates[0]?.filePath).toBe('src/auth/auth.service.ts');

    // UserService should be retrieved via graph expansion
    const userCandidate = result.candidates.find((c) => c.filePath === 'src/users/user.service.ts');
    expect(userCandidate).toBeDefined();
    expect(userCandidate?.sources.some((s) => s.type === 'graph')).toBe(true);
  });
});

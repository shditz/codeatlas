import { describe, it, expect, beforeEach } from 'vitest';
import {
  AtlasDatabase,
  runMigrations,
  SearchRepository,
  FileRepository,
} from '@codeatlas-ai/storage';
import { DependencyGraph } from '@codeatlas-ai/graph';
import type { FileInfo } from '@codeatlas-ai/core';
import { RetrievalEngine } from '../retrieval-engine.js';

describe('Task-Aware Context Retrieval Engine', () => {
  let db: AtlasDatabase;
  let searchRepo: SearchRepository;
  let graph: DependencyGraph;
  let filesByPath: Map<string, FileInfo>;
  let retrieval: RetrievalEngine;

  beforeEach(() => {
    db = new AtlasDatabase(':memory:');
    runMigrations(db);
    searchRepo = new SearchRepository(db);
    graph = new DependencyGraph();
    filesByPath = new Map();

    const projRes = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'test', '/test');
    const projectId = Number(projRes.lastInsertRowid);
    const fileRepo = new FileRepository(db);

    const mockFiles: Array<{ relativePath: string; isTest: boolean; content: string }> = [
      {
        relativePath: 'src/app.ts',
        isTest: false,
        content: 'class AppController user authentication route handler',
      },
      {
        relativePath: 'src/services/user.service.ts',
        isTest: false,
        content: 'class UserService getUser findById throw UserNotFoundError',
      },
      {
        relativePath: 'src/models/user.model.ts',
        isTest: false,
        content: 'interface UserModel user schema type definition',
      },
      {
        relativePath: 'src/services/user.service.spec.ts',
        isTest: true,
        content: 'describe UserService test user error handling',
      },
      {
        relativePath: 'src/public-api.ts',
        isTest: false,
        content: 'export all public controllers and services',
      },
    ];

    for (const f of mockFiles) {
      const fileId = fileRepo.upsert(projectId, {
        path: `/test/${f.relativePath}`,
        relativePath: f.relativePath,
        extension: '.ts',
        language: 'typescript',
        size: 100,
        hash: 'hash',
        module: 'src',
        isTest: f.isTest,
        isGenerated: false,
        symbolCount: 1,
        importCount: 1,
        exportCount: 1,
      });

      const fileInfo = fileRepo.getByPath(projectId, f.relativePath);
      if (fileInfo) {
        filesByPath.set(f.relativePath, fileInfo);
      }
      searchRepo.indexFile(fileId, f.relativePath, f.content);
    }

    graph.addEdge({
      source: 'src/app.ts',
      target: 'src/services/user.service.ts',
      kind: 'import',
      symbols: ['UserService'],
      weight: 1.0,
      confidence: 1.0,
      resolution: 'semantic-ts',
    });
    graph.addEdge({
      source: 'src/services/user.service.ts',
      target: 'src/models/user.model.ts',
      kind: 'implements',
      symbols: ['UserModel'],
      weight: 1.2,
      confidence: 1.0,
      resolution: 'semantic-ts',
    });
    graph.addEdge({
      source: 'src/services/user.service.spec.ts',
      target: 'src/services/user.service.ts',
      kind: 'import',
      symbols: ['UserService'],
      weight: 1.0,
      confidence: 1.0,
      resolution: 'semantic-ts',
    });
    graph.addEdge({
      source: 'src/public-api.ts',
      target: 'src/app.ts',
      kind: 'export',
      symbols: ['AppController'],
      weight: 1.0,
      confidence: 1.0,
      resolution: 'semantic-ts',
    });

    retrieval = new RetrievalEngine(searchRepo, graph, filesByPath);
  });

  it('boosts callers and test files when intent is "bug"', () => {
    const bugResult = retrieval.retrieve('UserService findById', { limit: 10, intent: 'bug' });

    const testCandidate = bugResult.candidates.find(
      (c) => c.filePath === 'src/services/user.service.spec.ts',
    );
    expect(testCandidate).toBeDefined();
    const testReason = testCandidate?.sources.some((s) => s.detail.includes('bug fix intent'));
    expect(testReason).toBe(true);

    const callerCandidate = bugResult.candidates.find((c) => c.filePath === 'src/app.ts');
    expect(callerCandidate).toBeDefined();
    const callerReason = callerCandidate?.sources.some((s) =>
      s.detail.includes('Caller/Dependent'),
    );
    expect(callerReason).toBe(true);
  });

  it('boosts interfaces, models, and type definitions when intent is "feature"', () => {
    const featureResult = retrieval.retrieve('UserService', { limit: 10, intent: 'feature' });
    const modelCandidate = featureResult.candidates.find(
      (c) => c.filePath === 'src/models/user.model.ts',
    );

    expect(modelCandidate).toBeDefined();
    const modelReason = modelCandidate?.sources.some(
      (s) => s.detail.includes('feature intent') || s.detail.includes('implements'),
    );
    expect(modelReason).toBe(true);
  });

  it('boosts high-centrality and public API modules when intent is "refactor"', () => {
    const refactorResult = retrieval.retrieve('AppController', { limit: 10, intent: 'refactor' });
    const appCandidate = refactorResult.candidates.find((c) => c.filePath === 'src/app.ts');

    expect(appCandidate).toBeDefined();
    const refactorReason = appCandidate?.sources.some((s) =>
      s.detail.includes('refactor priority'),
    );
    expect(refactorReason).toBe(true);
  });
});

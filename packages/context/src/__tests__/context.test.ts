import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ContextEngine } from '../index.js';
import type { RankedResult } from '@codeatlas/ranking';
import type { ProjectMeta } from '@codeatlas/core';

describe('Context Engine & Token Budget Optimization', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-context-test-'));
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });

    fs.writeFileSync(
      path.join(tempDir, 'src', 'small.ts'),
      'export function add(a: number, b: number): number { return a + b; }',
    );

    fs.writeFileSync(
      path.join(tempDir, 'src', 'large.ts'),
      `
      import { something } from 'somewhere';
      export class LargeService {
        methodA() { return 1; }
        methodB() { return 2; }
        methodC() { return 3; }
      }
      ` + '\n// line of code'.repeat(100),
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const project: ProjectMeta = {
    name: 'test-app',
    root: '/test',
    languages: ['typescript'],
    frameworks: [],
    packageManager: 'pnpm',
    fileCount: 2,
    symbolCount: 5,
    dependencyCount: 1,
    isMonorepo: false,
    workspaces: [],
  };

  it('builds context pack within strict token budget', () => {
    const engine = new ContextEngine({
      tokenBudget: 500,
      defaultMode: 'full',
      repositoryRoot: tempDir,
    });

    const rankedResults: RankedResult[] = [
      {
        filePath: 'src/small.ts',
        relevance: 0.9,
        explanations: [{ signal: 'lexical', score: 0.9, weight: 0.25, reason: 'Keyword match' }],
        candidate: {
          filePath: 'src/small.ts',
          sources: [],
          file: {
            path: path.join(tempDir, 'src', 'small.ts'),
            relativePath: 'src/small.ts',
            extension: '.ts',
            language: 'typescript',
            size: 100,
            hash: 'h1',
            module: 'src',
            isTest: false,
            isGenerated: false,
            symbolCount: 1,
            importCount: 0,
            exportCount: 1,
          },
        },
      },
      {
        filePath: 'src/large.ts',
        relevance: 0.7,
        explanations: [{ signal: 'path', score: 0.7, weight: 0.15, reason: 'Path match' }],
        candidate: {
          filePath: 'src/large.ts',
          sources: [],
          file: {
            path: path.join(tempDir, 'src', 'large.ts'),
            relativePath: 'src/large.ts',
            extension: '.ts',
            language: 'typescript',
            size: 2000,
            hash: 'h2',
            module: 'src',
            isTest: false,
            isGenerated: false,
            symbolCount: 4,
            importCount: 1,
            exportCount: 1,
          },
        },
      },
    ];

    const pack = engine.build({
      task: 'Fix addition bug',
      project,
      rankedResults,
      rules: [
        {
          id: 'r1',
          source: 'agents.md',
          scope: 'global',
          filePath: 'AGENTS.md',
          content: 'Follow strict types.',
          priority: 10,
        },
      ],
    });

    expect(pack.tokenUsage).toBeLessThanOrEqual(pack.tokenBudget);
    expect(pack.files.length).toBeGreaterThanOrEqual(1);
    expect(pack.files[0]?.relativePath).toBe('src/small.ts');
    expect(pack.files[0]?.mode).toBe('full');
  });
});

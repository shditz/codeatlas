import { describe, it, expect } from 'vitest';
import { Ranker } from '../index.js';
import { defaultConfig } from '@codeatlas-ai/core';
import type { RetrievalCandidate } from '@codeatlas-ai/core';

describe('Ranking Engine', () => {
  it('ranks candidates using multi-signal scoring with explanations', () => {
    const config = defaultConfig();
    const ranker = new Ranker({
      weights: config.ranking,
      queryTerms: ['oauth', 'auth', 'login'],
    });

    const candidates: RetrievalCandidate[] = [
      {
        filePath: 'src/auth/oauth.service.ts',
        sources: [
          { type: 'keyword', score: 8.5, detail: 'FTS match' },
          { type: 'symbol', score: 0.9, detail: 'Symbol match: OAuthService' },
          { type: 'path', score: 1.0, detail: 'Path contains auth, oauth' },
        ],
        file: {
          path: '/app/src/auth/oauth.service.ts',
          relativePath: 'src/auth/oauth.service.ts',
          extension: '.ts',
          language: 'typescript',
          size: 1024,
          hash: 'h1',
          module: 'src/auth',
          isTest: false,
          isGenerated: false,
          symbolCount: 5,
          importCount: 2,
          exportCount: 1,
        },
      },
      {
        filePath: 'src/components/button.tsx',
        sources: [{ type: 'path', score: 0.0, detail: 'No match' }],
        file: {
          path: '/app/src/components/button.tsx',
          relativePath: 'src/components/button.tsx',
          extension: '.tsx',
          language: 'typescript',
          size: 512,
          hash: 'h2',
          module: 'src/components',
          isTest: false,
          isGenerated: false,
          symbolCount: 1,
          importCount: 1,
          exportCount: 1,
        },
      },
    ];

    const ranked = ranker.rank(candidates);

    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.filePath).toBe('src/auth/oauth.service.ts');
    expect(ranked[0]?.relevance).toBeGreaterThan(0.5);
    expect(ranked[0]?.explanations.length).toBeGreaterThan(0);
    expect(ranked[1]?.relevance).toBeLessThan(0.1);
  });
});

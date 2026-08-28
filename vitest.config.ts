import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@codeatlas/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@codeatlas/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@codeatlas/storage': path.resolve(__dirname, 'packages/storage/src/index.ts'),
      '@codeatlas/git': path.resolve(__dirname, 'packages/git/src/index.ts'),
      '@codeatlas/parser': path.resolve(__dirname, 'packages/parser/src/index.ts'),
      '@codeatlas/indexer': path.resolve(__dirname, 'packages/indexer/src/index.ts'),
      '@codeatlas/graph': path.resolve(__dirname, 'packages/graph/src/index.ts'),
      '@codeatlas/retrieval': path.resolve(__dirname, 'packages/retrieval/src/index.ts'),
      '@codeatlas/ranking': path.resolve(__dirname, 'packages/ranking/src/index.ts'),
      '@codeatlas/token-counter': path.resolve(__dirname, 'packages/token-counter/src/index.ts'),
      '@codeatlas/context': path.resolve(__dirname, 'packages/context/src/index.ts'),
      '@codeatlas/rules': path.resolve(__dirname, 'packages/rules/src/index.ts'),
      '@codeatlas/exporters': path.resolve(__dirname, 'packages/exporters/src/index.ts'),
      '@codeatlas/mcp': path.resolve(__dirname, 'packages/mcp/src/index.ts'),
      '@codeatlas/llm': path.resolve(__dirname, 'packages/llm/src/index.ts'),
      '@codeatlas/compression': path.resolve(__dirname, 'packages/compression/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['node:sqlite', 'tree-sitter'],
  },
  ssr: {
    external: ['node:sqlite', 'tree-sitter'],
  },
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    server: {
      deps: {
        external: ['node:sqlite', 'tree-sitter'],
      },
    },
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/index.ts'],
    },
    testTimeout: 30000,
  },
});

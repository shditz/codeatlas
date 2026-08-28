import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@codeatlas-ai/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@codeatlas-ai/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@codeatlas-ai/storage': path.resolve(__dirname, 'packages/storage/src/index.ts'),
      '@codeatlas-ai/git': path.resolve(__dirname, 'packages/git/src/index.ts'),
      '@codeatlas-ai/parser': path.resolve(__dirname, 'packages/parser/src/index.ts'),
      '@codeatlas-ai/indexer': path.resolve(__dirname, 'packages/indexer/src/index.ts'),
      '@codeatlas-ai/graph': path.resolve(__dirname, 'packages/graph/src/index.ts'),
      '@codeatlas-ai/retrieval': path.resolve(__dirname, 'packages/retrieval/src/index.ts'),
      '@codeatlas-ai/ranking': path.resolve(__dirname, 'packages/ranking/src/index.ts'),
      '@codeatlas-ai/token-counter': path.resolve(__dirname, 'packages/token-counter/src/index.ts'),
      '@codeatlas-ai/context': path.resolve(__dirname, 'packages/context/src/index.ts'),
      '@codeatlas-ai/rules': path.resolve(__dirname, 'packages/rules/src/index.ts'),
      '@codeatlas-ai/exporters': path.resolve(__dirname, 'packages/exporters/src/index.ts'),
      '@codeatlas-ai/mcp': path.resolve(__dirname, 'packages/mcp/src/index.ts'),
      '@codeatlas-ai/llm': path.resolve(__dirname, 'packages/llm/src/index.ts'),
      '@codeatlas-ai/compression': path.resolve(__dirname, 'packages/compression/src/index.ts'),
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

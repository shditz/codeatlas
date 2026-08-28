import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  external: ['vscode'],
  noExternal: [/@codeatlas-ai\/.*/],
  clean: true,
  sourcemap: true,
});

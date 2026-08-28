import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  external: ['node:sqlite'],
  dts: true,
  clean: true,
  sourcemap: true,
});

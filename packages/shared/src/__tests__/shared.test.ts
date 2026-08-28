import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  toRelativePath,
  getExtension,
  getBasename,
  getDirname,
  getModule,
  hashContent,
  formatBytes,
  formatDuration,
  pluralize,
  groupBy,
  unique,
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
} from '../index.js';

describe('Paths and Utils', () => {
  it('normalizes windows backslashes to forward slashes', () => {
    expect(normalizePath('src\\auth\\service.ts')).toBe('src/auth/service.ts');
  });

  it('computes relative path correctly', () => {
    expect(toRelativePath('C:/project/src/index.ts', 'C:/project')).toBe('src/index.ts');
  });

  it('extracts extensions, basenames, and dirnames', () => {
    expect(getExtension('foo.ts')).toBe('.ts');
    expect(getExtension('foo.spec.tsx')).toBe('.tsx');
    expect(getExtension('Dockerfile')).toBe('');
    expect(getBasename('src/auth/service.ts')).toBe('service.ts');
    expect(getDirname('src/auth/service.ts')).toBe('src/auth');
  });

  it('determines module boundary', () => {
    expect(getModule('C:/project/src/auth/service.ts', 'C:/project')).toBe('src/auth');
    expect(getModule('C:/project/index.ts', 'C:/project')).toBe('.');
  });

  it('hashes content deterministically', () => {
    const h1 = hashContent('hello');
    const h2 = hashContent('hello');
    const h3 = hashContent('world');
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1.length).toBe(64);
  });

  it('formats bytes and duration', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(0)).toBe('0 B');
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(pluralize(1, 'file')).toBe('file');
    expect(pluralize(3, 'file')).toBe('files');
  });

  it('groups by and gets unique items', () => {
    const items = [
      { type: 'a', val: 1 },
      { type: 'b', val: 2 },
      { type: 'a', val: 3 },
    ];
    const grouped = groupBy(items, (i) => i.type);
    expect(grouped.a).toHaveLength(2);
    expect(grouped.b).toHaveLength(1);
    expect(unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
  });

  it('handles Result monad correctly', () => {
    const success = ok(42);
    const failure = err(new Error('fail'));

    expect(isOk(success)).toBe(true);
    expect(isErr(failure)).toBe(true);
    expect(unwrap(success)).toBe(42);
    expect(unwrapOr(failure, 0)).toBe(0);
    expect(() => unwrap(failure)).toThrow('fail');
  });
});

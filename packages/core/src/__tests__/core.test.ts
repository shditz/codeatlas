import { describe, it, expect } from 'vitest';
import {
  defaultConfig,
  parseConfig,
  detectLanguage,
  isTestFile,
  isGeneratedFile,
} from '../index.js';

describe('Core Config & Languages', () => {
  it('loads valid default config', () => {
    const config = defaultConfig();
    expect(config.context.max_tokens).toBe(12000);
    expect(config.ranking.lexical_weight).toBe(0.25);
    expect(config.security.scan_secrets).toBe(true);
  });

  it('parses custom config overrides', () => {
    const config = parseConfig({
      context: { max_tokens: 8000, default_mode: 'signature' },
      ranking: { lexical_weight: 0.5 },
    });
    expect(config.context.max_tokens).toBe(8000);
    expect(config.context.default_mode).toBe('signature');
    expect(config.ranking.lexical_weight).toBe(0.5);
  });

  it('detects languages accurately', () => {
    expect(detectLanguage('src/app.ts')).toBe('typescript');
    expect(detectLanguage('src/component.tsx')).toBe('typescript');
    expect(detectLanguage('lib/index.js')).toBe('javascript');
    expect(detectLanguage('main.py')).toBe('python');
    expect(detectLanguage('main.go')).toBe('go');
    expect(detectLanguage('src/lib.rs')).toBe('rust');
    expect(detectLanguage('Dockerfile')).toBe('dockerfile');
    expect(detectLanguage('README.md')).toBe('markdown');
  });

  it('identifies test and generated files', () => {
    expect(isTestFile('src/auth.test.ts')).toBe(true);
    expect(isTestFile('src/__tests__/auth.ts')).toBe(true);
    expect(isTestFile('src/auth.service.ts')).toBe(false);

    expect(isGeneratedFile('dist/index.js')).toBe(true);
    expect(isGeneratedFile('src/types.d.ts')).toBe(true);
    expect(isGeneratedFile('src/index.ts')).toBe(false);
  });
});

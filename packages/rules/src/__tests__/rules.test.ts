import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { RuleEngine } from '../index.js';

describe('Rules Engine', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-rules-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  });

  it('discovers AGENTS.md, CLAUDE.md, and Cursor rules', () => {
    fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), '# Agents Instructions\nFollow these rules.');
    fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Claude Instructions\nUse TypeScript.');

    const cursorDir = path.join(tempDir, '.cursor', 'rules');
    fs.mkdirSync(cursorDir, { recursive: true });
    fs.writeFileSync(path.join(cursorDir, 'frontend.md'), '# Frontend rules\nUse Svelte.');

    const engine = new RuleEngine(tempDir);
    const rules = engine.discover();

    expect(rules).toHaveLength(3);

    const sources = rules.map((r) => r.source);
    expect(sources).toContain('agents.md');
    expect(sources).toContain('claude.md');
    expect(sources).toContain('cursor');
  });

  it('discovers Chinese and global AI agent rules (Trae, DeepSeek, Kimi, Grok, Devin, Roo)', () => {
    fs.writeFileSync(path.join(tempDir, '.traerules'), '# Trae Instructions');
    fs.writeFileSync(path.join(tempDir, 'DEEPSEEK.md'), '# DeepSeek reasoning guidelines');
    fs.writeFileSync(path.join(tempDir, 'KIMI.md'), '# Kimi 2M context rules');
    fs.writeFileSync(path.join(tempDir, 'GROK.md'), '# Grok Build guidelines');
    fs.writeFileSync(path.join(tempDir, 'DEVIN.md'), '# Devin cognition directives');
    fs.writeFileSync(path.join(tempDir, '.roorules'), '# Roo Cline instructions');

    const engine = new RuleEngine(tempDir);
    const rules = engine.discover();

    expect(rules).toHaveLength(6);
    const sources = rules.map((r) => r.source);
    expect(sources).toContain('trae');
    expect(sources).toContain('deepseek');
    expect(sources).toContain('kimi');
    expect(sources).toContain('grok');
    expect(sources).toContain('devin');
    expect(sources).toContain('roo');
  });

  it('detects rule conflicts (e.g. tabs vs spaces)', () => {
    fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), 'Rule: Use tabs for indentation.');
    fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), 'Rule: Use 2 spaces for indentation.');

    const engine = new RuleEngine(tempDir);
    engine.discover();

    const conflicts = engine.detectConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.reason).toContain('indentation');
  });
});

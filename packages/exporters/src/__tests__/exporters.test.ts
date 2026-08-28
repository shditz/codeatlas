import { describe, it, expect } from 'vitest';
import { createExporter } from '../index.js';
import type { ContextPack } from '@codeatlas/core';

describe('Exporters', () => {
  const samplePack: ContextPack = {
    task: 'Add Google OAuth login',
    timestamp: '2026-08-28T00:00:00.000Z',
    repository: {
      name: 'my-app',
      root: '/app',
      languages: ['typescript'],
      frameworks: ['next'],
      packageManager: 'pnpm',
      fileCount: 10,
      symbolCount: 50,
      dependencyCount: 15,
      isMonorepo: false,
      workspaces: [],
    },
    rules: [
      {
        id: 'r1',
        source: 'agents.md',
        scope: 'global',
        filePath: 'AGENTS.md',
        content: 'Use strict TypeScript and zod validation.',
        priority: 10,
      },
    ],
    files: [
      {
        path: '/app/src/auth/auth.service.ts',
        relativePath: 'src/auth/auth.service.ts',
        language: 'typescript',
        relevance: 0.95,
        mode: 'full',
        content: 'export class AuthService { login() {} }',
        tokenCount: 50,
        reasons: [{ signal: 'lexical', score: 0.9, weight: 0.25, reason: 'FTS match' }],
      },
    ],
    tokenBudget: 12000,
    tokenUsage: 120,
    tokenBreakdown: {
      architecture: 0,
      rules: 20,
      repositoryMap: 0,
      code: 100,
    },
    retrievalStats: {
      candidateCount: 5,
      selectedCount: 1,
      searchTimeMs: 2,
      rankingTimeMs: 1,
      totalTimeMs: 5,
    },
  };

  it('exports to Markdown, Claude, Cursor, and Antigravity formats', () => {
    const md = createExporter('markdown');
    expect(md.export(samplePack, { target: 'markdown' })).toContain(
      '# Context Pack: Add Google OAuth login',
    );

    const claude = createExporter('claude');
    expect(claude.export(samplePack, { target: 'claude' })).toContain('# Project Context');

    const cursor = createExporter('cursor');
    expect(cursor.export(samplePack, { target: 'cursor' })).toContain('# Relevant Context');

    const antigravity = createExporter('antigravity');
    expect(antigravity.export(samplePack, { target: 'antigravity' })).toContain(
      '# Antigravity Context Injection',
    );
  });

  it('exports to Chinese AI coding agents (Trae, DeepSeek, Qwen/Lingma, Comate, CodeGeeX, Kimi)', () => {
    const trae = createExporter('trae');
    expect(trae.export(samplePack, { target: 'trae' })).toContain(
      '# ByteDance Trae Workspace Context',
    );
    expect(trae.defaultFilename()).toBe('.traerules');

    const deepseek = createExporter('deepseek');
    expect(deepseek.export(samplePack, { target: 'deepseek' })).toContain(
      '# DeepSeek Coder Context Pack',
    );
    expect(deepseek.defaultFilename()).toBe('DEEPSEEK.atlas.md');

    const qwen = createExporter('qwen');
    expect(qwen.export(samplePack, { target: 'qwen' })).toContain(
      '# Alibaba Tongyi Lingma / Qwen Context',
    );
    expect(qwen.defaultFilename()).toBe('.lingmarules');

    const comate = createExporter('comate');
    expect(comate.export(samplePack, { target: 'comate' })).toContain('# Baidu Comate AI Context');
    expect(comate.defaultFilename()).toBe('.comaterules');

    const codegeex = createExporter('codegeex');
    expect(codegeex.export(samplePack, { target: 'codegeex' })).toContain(
      '# Zhipu AI CodeGeeX Context',
    );
    expect(codegeex.defaultFilename()).toBe('.codegeexrules');

    const kimi = createExporter('kimi');
    expect(kimi.export(samplePack, { target: 'kimi' })).toContain('# Moonshot Kimi Code Context');
    expect(kimi.defaultFilename()).toBe('KIMI.atlas.md');
  });

  it('exports to global AI coding agents (Grok, Replit, Devin, OpenHands, OpenCode, Vellum, Continue, Roo, Augment, AmazonQ)', () => {
    const grok = createExporter('grok');
    expect(grok.export(samplePack, { target: 'grok' })).toContain('# xAI Grok Build Context');

    const replit = createExporter('replit');
    expect(replit.export(samplePack, { target: 'replit' })).toContain(
      '# Replit Agent Project Context',
    );

    const devin = createExporter('devin');
    expect(devin.export(samplePack, { target: 'devin' })).toContain(
      '# Cognition Devin Workspace Context',
    );

    const openhands = createExporter('openhands');
    expect(openhands.export(samplePack, { target: 'openhands' })).toContain(
      '# OpenHands (OpenDevin) Context',
    );

    const opencode = createExporter('opencode');
    expect(opencode.export(samplePack, { target: 'opencode' })).toContain('# OpenCode AI Context');

    const vellum = createExporter('vellum');
    expect(vellum.export(samplePack, { target: 'vellum' })).toContain(
      '# Vellum AI Context Injection',
    );

    const cont = createExporter('continue');
    expect(cont.export(samplePack, { target: 'continue' })).toContain(
      '# Continue.dev Context Rules',
    );

    const roo = createExporter('roo');
    expect(roo.export(samplePack, { target: 'roo' })).toContain(
      '# Roo Code Context & Custom Rules',
    );

    const augment = createExporter('augment');
    expect(augment.export(samplePack, { target: 'augment' })).toContain('# Augment Code Context');

    const amazonq = createExporter('amazonq');
    expect(amazonq.export(samplePack, { target: 'amazonq' })).toContain(
      '# Amazon Q Developer Context',
    );
  });
});

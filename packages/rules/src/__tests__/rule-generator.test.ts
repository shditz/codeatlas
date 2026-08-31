import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { RuleGenerator } from '../index.js';
import type { ArchitectureReport } from '@codeatlas-ai/core';

describe('RuleGenerator (Evidence-Based Human-Approved AI Rules)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-rules-gen-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('proposes TypeScript strict typing rule based on tsconfig evidence', () => {
    fs.writeFileSync(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022' } }),
    );

    const generator = new RuleGenerator({ rootDir: tempDir });
    const proposed = generator.generateProposedRules();

    const tsRule = proposed.find((r) => r.id === 'ts_strict_types');
    expect(tsRule).toBeDefined();
    expect(tsRule?.evidence).toContain('"strict": true');
    expect(tsRule?.recommended).toBe(true);
  });

  it('proposes Vitest testing rule based on vitest.config.ts evidence', () => {
    fs.writeFileSync(path.join(tempDir, 'vitest.config.ts'), 'export default {}');
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ scripts: { test: 'vitest run' } }),
    );

    const generator = new RuleGenerator({ rootDir: tempDir });
    const proposed = generator.generateProposedRules();

    const testRule = proposed.find((r) => r.id === 'test_vitest_framework');
    expect(testRule).toBeDefined();
    expect(testRule?.evidence).toContain('vitest configuration');
  });

  it('proposes Architecture Layer and Bounded Context rules from ArchitectureReport evidence', () => {
    const mockArchReport: ArchitectureReport = {
      architectureType: 'layered',
      layers: [
        { name: 'presentation', patterns: ['**/controllers/**'] },
        { name: 'application', patterns: ['**/services/**'] },
        { name: 'domain', patterns: ['**/domain/**'] },
        { name: 'infrastructure', patterns: ['**/repositories/**'] },
      ],
      boundedContexts: [
        { name: 'auth', patterns: ['**/auth/**'], files: [] },
        { name: 'billing', patterns: ['**/billing/**'], files: [] },
      ],
      violations: [],
      summary: { totalViolations: 0, critical: 0, high: 0, medium: 0, low: 0, cleanScore: 100 },
    };

    const generator = new RuleGenerator({ rootDir: tempDir, architectureReport: mockArchReport });
    const proposed = generator.generateProposedRules();

    const layerRule = proposed.find((r) => r.id === 'arch_layered_controllers_services');
    expect(layerRule).toBeDefined();
    expect(layerRule?.evidence).toContain('Architecture Analyzer');

    const contextRule = proposed.find((r) => r.id === 'arch_bounded_context_public_api');
    expect(contextRule).toBeDefined();
    expect(contextRule?.evidence).toContain('2 isolated bounded contexts');
  });

  it('generates markdown documentation strictly with approved rules and evidence citations', () => {
    const generator = new RuleGenerator({ rootDir: tempDir });
    const approved = [
      {
        id: 'ts_strict',
        category: 'typescript' as const,
        title: 'Strict Typing Requirement',
        ruleText: 'Never use any. Explicit interfaces required.',
        evidence: 'Found tsconfig.json with strict=true',
        confidence: 'high' as const,
        recommended: true,
      },
      {
        id: 'arch_flow',
        category: 'architecture' as const,
        title: 'Layer Flow',
        ruleText: 'Controllers must call Services.',
        evidence: 'Detected layered architecture',
        confidence: 'high' as const,
        recommended: true,
      },
    ];

    const doc = generator.generateRuleDocument(
      approved,
      {
        name: 'MyProject',
        languages: ['TypeScript'],
        frameworks: ['React'],
        packageManager: 'pnpm',
      },
      'agents',
    );

    expect(doc).toContain('# MyProject — AI Coding Guidelines (AGENTS)');
    expect(doc).toContain('Strict Typing Requirement');
    expect(doc).toContain('*Evidence*: _Found tsconfig.json with strict=true_');
    expect(doc).toContain('Layer Flow');
    expect(doc).toContain('Controllers must call Services.');
  });
});

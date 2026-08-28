# xAI Grok Build Context

Task: Implement OAuth

# CodeAtlas AI Instructions

- Always write strictly-typed TypeScript with TypeScript 5.x.
- Keep packages decoupled and communicate through domain models in `@codeatlas/core`.
- Maintain 100% test pass rate with Vitest.
- Follow local-first privacy principles: never upload repository code without user consent.


# CodeAtlas Cursor Rules

- Always write strictly-typed TypeScript with TypeScript 5.x.
- Keep packages decoupled and communicate through domain models in `@codeatlas/core`.
- Maintain 100% test pass rate with Vitest.
- Follow local-first privacy principles: never upload repository code without user consent.


# ByteDance Trae Workspace Context

Task: Implement OAuth

# CodeAtlas AI Instructions

- Always write strictly-typed TypeScript with TypeScript 5.x.
- Keep packages decoupled and communicate through domain models in `@codeatlas/core`.
- Maintain 100% test pass rate with Vitest.
- Follow local-first privacy principles: never upload repository code without user consent.


# CodeAtlas Cursor Rules

- Always write strictly-typed TypeScript with TypeScript 5.x.
- Keep packages decoupled and communicate through domain models in `@codeatlas/core`.
- Maintain 100% test pass rate with Vitest.
- Follow local-first privacy principles: never upload repository code without user consent.


## packages/core/src/models.ts
```typescript
export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'json'
  | 'yaml'
  | 'toml'
  | 'markdown'
  | 'html'
  | 'css'
  | 'scss'
  | 'sql'
  | 'shell'
  | 'dockerfile'
  | 'unknown';

export type SymbolKind =
  | 'class'
  | 'function'
  | 'method'
  | 'interface'
  | 'type'
  | 'enum'
  | 'struct'
  | 'trait'
  | 'variable'
  | 'constant'
  | 'property'
  | 'export';

export type DependencyKind = 'import' | 'export' | 'extends' | 'implements' | 'reference';

export type ContextMode = 'full' | 'signature' | 'summary' | 'digest';

export type RuleSource =
  | 'agents.md'
  | 'claude.md'
  | 'gemini.md'
  | 'cursor'
  | 'copilot'
  | 'atlas'
  | 'custom'
  | 'trae'
  | 'deepseek'
  | 'qwen'
  | 'lingma'
  | 'comate'
  | 'codegeex'
  | 'kimi'
  | 'grok'
  | 'replit'
  | 'devin'
  | 'opencode'
  | 'vellum'
  | 'openhands'
  | 'continue'
  | 'roo'
  | 'augment'
  | 'amazonq';

export type ExportTarget =
  | 'markdown'
  | 'claude'
  | 'cursor'
  | 'copilot'
  | 'gemini'
  | 'agents'
  | 'antigravity'
  | 'codex'
  | 'aider'
  | 'windsurf'
  | 'cline'
  | 'trae'
  | 'deepseek'
  | 'qwen'
  | 'lingma'
  | 'comate'
  | 'codegeex'
  | 'kimi'
  | 'grok'
  | 'replit'
  | 'devin'
  | 'opencode'
  | 'vellum'
  | 'openhands'
  | 'continue'
  | 'roo'
  | 'augment'
  | 'amazonq';

export type RuleScope = 'global' | 'path' | 'file';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

export type Framework =
  | 'next'
  | 'react'
  | 'vue'
  | 'svelte'
  | 'angular'
  | 'express'
  | 'fastify'
  | 'nestjs'
  | 'django'
  | 'flask'
  | 'spring'
  | 'unknown';

export interface ProjectMeta {
  name: string;
  root: string;
  languages: Language[];
  frameworks: Framework[];
  packageManager: PackageManager;
  fileCount: number;
  symbolCount: number;
  dependencyCount: number;
  isMonorepo: boolean;
  workspaces: string[];
}

export interface FileInfo {
  id?: number;
  path: string;
  relativePath: string;
  extension: string;
  language: Language;
  size: number;
  hash: string;
  module: string;
  isTest: boolean;
  isGenerated: boolean;
  symbolCount: number;
  importCount: number;
  exportCount: number;
  lastModified?: number;
}

export interface SymbolInfo {
  id?: number;
  name: string;
  kind: SymbolKind;
  filePath: string;
  line: number;
  endLine?: number;
  column: number;
  exported: boolean;
  signature?: string;
  parentSymbol?: string;
}

export interface ImportInfo {
  id?: number;
  filePath: string;
  importPath: string;
  resolvedPath?: string;
  symbols: string[];
  isDefault: boolean;
  isNamespace: boolean;
  isType: boolean;
}

export interface DependencyEdge {
  source: string;
  target: string;
  kind: DependencyKind;
  symbols: string[];
  weight: number;
}

export interface Rule {
  id: string;
  source: RuleSource;
  scope: RuleScope;
  filePath: string;
  content: string;
  priority: number;
  pathPattern?: string;
  agentTarget?: string;
}

export interface RuleConflict {
  ruleA: Rule;
  ruleB: Rule;
  reason: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface ScoreExplanation {
  signal: string;
  score: number;
  weight: number;
  reason: string;
}

export interface RetrievalSource {
  type: 'keyword' | 'symbol' | 'path' | 'graph';
  score: number;
  detail: string;
}

export interface RetrievalCandidate {
  filePath: string;
  file?: FileInfo;
  sources: RetrievalSource[];
  ftsRank?: number;
}

export interface ContextFile {
  path: string;
  relativePath: string;
  language: Language;
  relevance: number;
  mode: ContextMode;
  content: string;
  tokenCount: number;
  reasons: ScoreExplanation[];
}

export interface ContextPack {
  task: string;
  timestamp: string;
  repository: ProjectMeta;
  architecture?: string;
  repositoryMap?: string;
  rules: Rule[];
  files: ContextFile[];
  tokenBudget: number;
  tokenUsage: number;
  tokenBreakdown: {
    architecture: number;
    rules: number;
    repositoryMap: number;
    code: number;
  };
  retrievalStats: {
    candidateCount: number;
    selectedCount: number;
    searchTimeMs: number;
    rankingTimeMs: number;
    totalTimeMs: number;
  };
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  score: number;
  message: string;
  details?: string;
}

export interface HealthReport {
  overallScore: number;
  checks: HealthCheck[];
  categories: {
    architecture: number;
    rules: number;
    coverage: number;
    freshness: number;
    consistency: number;
    tokenEfficiency: number;
  };
}

export interface ScanResult {
  project: ProjectMeta;
  detectedFiles: number;
  skippedFiles: number;
  detectedLanguages: Map<Language, number>;
  detectedFrameworks: Framework[];
  detectedPackageManager: PackageManager;
  isMonorepo: boolean;
  workspaces: string[];
  hasTests: boolean;
  hasDocs: boolean;
  hasCI: boolean;
  duration: number;
}

export interface IndexState {
  lastIndexed: number;
  fileCount: number;
  symbolCount: number;
  importCount: number;
  version: string;
  hash: string;
}

```

## packages/exporters/src/exporters.ts
```typescript
import type { ContextPack, ExportTarget } from '@codeatlas/core';

export { type ExportTarget };

export interface ExportOptions {
  target: ExportTarget;
  outputPath?: string;
  merge?: boolean;
}

export interface Exporter {
  export(pack: ContextPack, options: ExportOptions): string;
  defaultFilename(): string;
}

function formatRules(pack: ContextPack): string[] {
  const lines: string[] = [];
  if (pack.rules.length > 0) {
    for (const rule of pack.rules) {
      lines.push(rule.content);
      lines.push('');
    }
  }
  return lines;
}

function formatFiles(pack: ContextPack): string[] {
  const lines: string[] = [];
  for (const file of pack.files) {
    lines.push(`## ${file.relativePath}`);
    lines.push('```' + file.language);
    lines.push(file.content);
    lines.push('```');
    lines.push('');
  }
  return lines;
}

export class MarkdownExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];

    lines.push(`# Context Pack: ${pack.task}`);
    lines.push('');
    lines.push(`> Generated by CodeAtlas at ${pack.timestamp}`);
    lines.push('');

    lines.push('## Repository');
    lines.push('');
    lines.push(`- **Name**: ${pack.repository.name}`);
    lines.push(`- **Languages**: ${pack.repository.languages.join(', ')}`);
    lines.push(`- **Frameworks**: ${pack.repository.frameworks.join(', ') || 'none detected'}`);
    lines.push(`- **Files**: ${pack.repository.fileCount}`);
    lines.push('');

    lines.push('## Token Budget');
    lines.push('');
    lines.push(`| Category | Tokens |`);
    lines.push(`|----------|--------|`);
    lines.push(`| Rules | ${pack.tokenBreakdown.rules.toLocaleString()} |`);
    lines.push(`| Repository Map | ${pack.tokenBreakdown.repositoryMap.toLocaleString()} |`);
    lines.push(`| Code | ${pack.tokenBreakdown.code.toLocaleString()} |`);
    lines.push(
      `| **Total** | **${pack.tokenUsage.toLocaleString()} / ${pack.tokenBudget.toLocaleString()}** |`,
    );
    lines.push('');

    if (pack.rules.length > 0) {
      lines.push('## Applicable Rules');
      lines.push('');
      for (const rule of pack.rules) {
        lines.push(`### From \`${rule.filePath}\` (${rule.source}, priority: ${rule.priority})`);
        lines.push('');
        lines.push(rule.content);
        lines.push('');
      }
    }

    if (pack.repositoryMap) {
      lines.push('## Repository Map');
      lines.push('');
      lines.push('```');
      lines.push(pack.repositoryMap);
      lines.push('```');
      lines.push('');
    }

    lines.push('## Relevant Files');
    lines.push('');

    for (const file of pack.files) {
      lines.push(`### \`${file.relativePath}\``);
      lines.push('');
      lines.push(
        `- **Language**: ${file.language} | **Mode**: ${file.mode} | **Relevance**: ${(file.relevance * 100).toFixed(0)}% | **Tokens**: ${file.tokenCount.toLocaleString()}`,
      );

      if (file.reasons.length > 0) {
        const reasonStr = file.reasons
          .map((r) => `${r.signal} (${(r.score * 100).toFixed(0)}%)`)
          .join(', ');
        lines.push(`- **Signals**: ${reasonStr}`);
      }

      lines.push('');
      lines.push('```' + file.language);
      lines.push(file.content);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'context-pack.md';
  }
}

export class ClaudeExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Project Context');
    lines.push('');
    lines.push(`> Generated for task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'CLAUDE.atlas.md';
  }
}

export class CursorExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Relevant Context');
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.cursorrules';
  }
}

export class CopilotExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# GitHub Copilot Context');
    lines.push('');
    lines.push(`## Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.github/copilot-instructions.atlas.md';
  }
}

export class GeminiExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Gemini Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'GEMINI.atlas.md';
  }
}

export class AgentsExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Agents Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'AGENTS.atlas.md';
  }
}

export class AntigravityExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Antigravity Context Injection');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push(`Generated: ${pack.timestamp}`);
    lines.push('');
    lines.push('## Project Directives');
    lines.push(...formatRules(pack));
    lines.push('## Relevant Codebase Files');
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'ANTIGRAVITY.atlas.md';
  }
}

export class CodexExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push(`// Task: ${pack.task}`);
    lines.push(`// Context Pack: ${pack.files.length} files`);
    lines.push('');
    for (const rule of pack.rules) {
      lines.push(`// Rule: ${rule.content}`);
    }
    lines.push('');
    for (const file of pack.files) {
      lines.push(`// File: ${file.relativePath}`);
      lines.push(file.content);
      lines.push('');
    }
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'CODEX.atlas.md';
  }
}

export class AiderExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Aider Context Instructions');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.aider.atlas.md';
  }
}

export class WindsurfExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Windsurf Rules & Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.windsurfrules';
  }
}

export class ClineExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Cline Custom Instructions & Context');
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.clinerules';
  }
}

export class TraeExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# ByteDance Trae Workspace Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.traerules';
  }
}

export class DeepSeekExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# DeepSeek Coder Context Pack');
    lines.push('');
    lines.push(`## Task Objective\n${pack.task}\n`);
    lines.push('## Coding Directives & Rules');
    lines.push(...formatRules(pack));
    lines.push('## Codebase Context Files');
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'DEEPSEEK.atlas.md';
  }
}

export class QwenExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Alibaba Tongyi Lingma / Qwen Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.lingmarules';
  }
}

export class ComateExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Baidu Comate AI Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.comaterules';
  }
}

export class CodeGeeXExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Zhipu AI CodeGeeX Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.codegeexrules';
  }
}

export class KimiExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Moonshot Kimi Code Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'KIMI.atlas.md';
  }
}

export class GrokExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# xAI Grok Build Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'GROK.atlas.md';
  }
}

export class ReplitExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Replit Agent Project Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'REPLIT.atlas.md';
  }
}

export class DevinExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Cognition Devin Workspace Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'DEVIN.atlas.md';
  }
}

export class OpenCodeExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# OpenCode AI Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'OPENCODE.atlas.md';
  }
}

export class VellumExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Vellum AI Context Injection');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'VELLUM.atlas.md';
  }
}

export class OpenHandsExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# OpenHands (OpenDevin) Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'OPENHANDS.atlas.md';
  }
}

export class ContinueExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Continue.dev Context Rules');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.continue/rules.atlas.md';
  }
}

export class RooExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Roo Code Context & Custom Rules');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.roorules';
  }
}

export class AugmentExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Augment Code Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.augmentrules';
  }
}

export class AmazonQExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Amazon Q Developer Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'AMAZONQ.atlas.md';
  }
}

export function createExporter(target: ExportTarget): Exporter {
  switch (target) {
    case 'markdown':
      return new MarkdownExporter();
    case 'claude':
      return new ClaudeExporter();
    case 'cursor':
      return new CursorExporter();
    case 'copilot':
      return new CopilotExporter();
    case 'gemini':
      return new GeminiExporter();
    case 'agents':
      return new AgentsExporter();
    case 'antigravity':
      return new AntigravityExporter();
    case 'codex':
      return new CodexExporter();
    case 'aider':
      return new AiderExporter();
    case 'windsurf':
      return new WindsurfExporter();
    case 'cline':
      return new ClineExporter();
    case 'trae':
      return new TraeExporter();
    case 'deepseek':
      return new DeepSeekExporter();
    case 'qwen':
    case 'lingma':
      return new QwenExporter();
    case 'comate':
      return new ComateExporter();
    case 'codegeex':
      return new CodeGeeXExporter();
    case 'kimi':
      return new KimiExporter();
    case 'grok':
      return new GrokExporter();
    case 'replit':
      return new ReplitExporter();
    case 'devin':
      return new DevinExporter();
    case 'opencode':
      return new OpenCodeExporter();
    case 'vellum':
      return new VellumExporter();
    case 'openhands':
      return new OpenHandsExporter();
    case 'continue':
      return new ContinueExporter();
    case 'roo':
      return new RooExporter();
    case 'augment':
      return new AugmentExporter();
    case 'amazonq':
      return new AmazonQExporter();
    default:
      return new MarkdownExporter();
  }
}

```

## packages/exporters/src/__tests__/exporters.test.ts
```typescript
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
    expect(md.export(samplePack, { target: 'markdown' })).toContain('# Context Pack: Add Google OAuth login');

    const claude = createExporter('claude');
    expect(claude.export(samplePack, { target: 'claude' })).toContain('# Project Context');

    const cursor = createExporter('cursor');
    expect(cursor.export(samplePack, { target: 'cursor' })).toContain('# Relevant Context');

    const antigravity = createExporter('antigravity');
    expect(antigravity.export(samplePack, { target: 'antigravity' })).toContain('# Antigravity Context Injection');
  });

  it('exports to Chinese AI coding agents (Trae, DeepSeek, Qwen/Lingma, Comate, CodeGeeX, Kimi)', () => {
    const trae = createExporter('trae');
    expect(trae.export(samplePack, { target: 'trae' })).toContain('# ByteDance Trae Workspace Context');
    expect(trae.defaultFilename()).toBe('.traerules');

    const deepseek = createExporter('deepseek');
    expect(deepseek.export(samplePack, { target: 'deepseek' })).toContain('# DeepSeek Coder Context Pack');
    expect(deepseek.defaultFilename()).toBe('DEEPSEEK.atlas.md');

    const qwen = createExporter('qwen');
    expect(qwen.export(samplePack, { target: 'qwen' })).toContain('# Alibaba Tongyi Lingma / Qwen Context');
    expect(qwen.defaultFilename()).toBe('.lingmarules');

    const comate = createExporter('comate');
    expect(comate.export(samplePack, { target: 'comate' })).toContain('# Baidu Comate AI Context');
    expect(comate.defaultFilename()).toBe('.comaterules');

    const codegeex = createExporter('codegeex');
    expect(codegeex.export(samplePack, { target: 'codegeex' })).toContain('# Zhipu AI CodeGeeX Context');
    expect(codegeex.defaultFilename()).toBe('.codegeexrules');

    const kimi = createExporter('kimi');
    expect(kimi.export(samplePack, { target: 'kimi' })).toContain('# Moonshot Kimi Code Context');
    expect(kimi.defaultFilename()).toBe('KIMI.atlas.md');
  });

  it('exports to global AI coding agents (Grok, Replit, Devin, OpenHands, OpenCode, Vellum, Continue, Roo, Augment, AmazonQ)', () => {
    const grok = createExporter('grok');
    expect(grok.export(samplePack, { target: 'grok' })).toContain('# xAI Grok Build Context');

    const replit = createExporter('replit');
    expect(replit.export(samplePack, { target: 'replit' })).toContain('# Replit Agent Project Context');

    const devin = createExporter('devin');
    expect(devin.export(samplePack, { target: 'devin' })).toContain('# Cognition Devin Workspace Context');

    const openhands = createExporter('openhands');
    expect(openhands.export(samplePack, { target: 'openhands' })).toContain('# OpenHands (OpenDevin) Context');

    const opencode = createExporter('opencode');
    expect(opencode.export(samplePack, { target: 'opencode' })).toContain('# OpenCode AI Context');

    const vellum = createExporter('vellum');
    expect(vellum.export(samplePack, { target: 'vellum' })).toContain('# Vellum AI Context Injection');

    const cont = createExporter('continue');
    expect(cont.export(samplePack, { target: 'continue' })).toContain('# Continue.dev Context Rules');

    const roo = createExporter('roo');
    expect(roo.export(samplePack, { target: 'roo' })).toContain('# Roo Code Context & Custom Rules');

    const augment = createExporter('augment');
    expect(augment.export(samplePack, { target: 'augment' })).toContain('# Augment Code Context');

    const amazonq = createExporter('amazonq');
    expect(amazonq.export(samplePack, { target: 'amazonq' })).toContain('# Amazon Q Developer Context');
  });
});

```

## packages/llm/src/llm-provider.ts
```typescript
import { createLogger } from '@codeatlas/shared';

const logger = createLogger('llm');

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  systemPrompt?: string;
}

export interface LLMProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export interface LLMProvider {
  name: string;
  complete(prompt: string, options?: LLMOptions): Promise<string>;
  isAvailable(): boolean;
}

export class NoopLLMProvider implements LLMProvider {
  name = 'none';

  async complete(_prompt: string, _options?: LLMOptions): Promise<string> {
    return '';
  }

  isAvailable(): boolean {
    return false;
  }
}

export class OpenAiCompatibleProvider implements LLMProvider {
  public name: string;
  protected apiKey: string;
  protected baseUrl: string;
  protected defaultModel: string;
  protected timeoutMs: number;

  constructor(config: {
    name: string;
    apiKey?: string;
    baseUrl: string;
    defaultModel: string;
    timeoutMs?: number;
  }) {
    this.name = config.name;
    this.apiKey = config.apiKey ?? '';
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.defaultModel = config.defaultModel;
    this.timeoutMs = config.timeoutMs ?? 30000;
  }

  isAvailable(): boolean {
    return this.name === 'ollama' || Boolean(this.apiKey);
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const model = options?.model ?? this.defaultModel;

    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const body = {
      model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 2048,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content?.trim() ?? '';
    } catch (err) {
      logger.warn(`LLM completion failed for ${this.name}:`, err);
      throw err;
    }
  }
}

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = config.apiKey ?? process.env['ANTHROPIC_API_KEY'] ?? '';
    this.baseUrl = (config.baseUrl ?? 'https://api.anthropic.com/v1').replace(/\/$/, '');
    this.defaultModel = config.model ?? 'claude-3-5-haiku-latest';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const url = `${this.baseUrl}/messages`;
    const model = options?.model ?? this.defaultModel;

    const body = {
      model,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.2,
      system: options?.systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic HTTP ${res.status}: ${err}`);
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      return data.content?.[0]?.text?.trim() ?? '';
    } catch (err) {
      logger.warn('Anthropic completion failed:', err);
      throw err;
    }
  }
}

export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  private apiKey: string;
  private defaultModel: string;

  constructor(config: { apiKey?: string; model?: string }) {
    this.apiKey = config.apiKey ?? process.env['GEMINI_API_KEY'] ?? process.env['GOOGLE_API_KEY'] ?? '';
    this.defaultModel = config.model ?? 'gemini-2.0-flash';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const model = options?.model ?? this.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxTokens ?? 2048,
      },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${err}`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    } catch (err) {
      logger.warn('Gemini completion failed:', err);
      throw err;
    }
  }
}

export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  const provider = config.provider.toLowerCase();

  switch (provider) {
    case 'deepseek':
      return new OpenAiCompatibleProvider({
        name: 'deepseek',
        apiKey: config.apiKey ?? process.env['DEEPSEEK_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://api.deepseek.com/v1',
        defaultModel: config.model ?? 'deepseek-chat',
      });

    case 'qwen':
    case 'lingma':
    case 'dashscope':
      return new OpenAiCompatibleProvider({
        name: 'qwen',
        apiKey: config.apiKey ?? process.env['DASHSCOPE_API_KEY'] ?? process.env['QWEN_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        defaultModel: config.model ?? 'qwen-plus',
      });

    case 'kimi':
    case 'moonshot':
      return new OpenAiCompatibleProvider({
        name: 'kimi',
        apiKey: config.apiKey ?? process.env['MOONSHOT_API_KEY'] ?? process.env['KIMI_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://api.moonshot.cn/v1',
        defaultModel: config.model ?? 'moonshot-v1-8k',
      });

    case 'grok':
    case 'xai':
      return new OpenAiCompatibleProvider({
        name: 'grok',
        apiKey: config.apiKey ?? process.env['XAI_API_KEY'] ?? process.env['GROK_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://api.x.ai/v1',
        defaultModel: config.model ?? 'grok-beta',
      });

    case 'ollama':
      return new OpenAiCompatibleProvider({
        name: 'ollama',
        apiKey: 'ollama',
        baseUrl: config.baseUrl ?? 'http://localhost:11434/v1',
        defaultModel: config.model ?? 'qwen2.5-coder:7b',
      });

    case 'openai':
      return new OpenAiCompatibleProvider({
        name: 'openai',
        apiKey: config.apiKey ?? process.env['OPENAI_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://api.openai.com/v1',
        defaultModel: config.model ?? 'gpt-4o-mini',
      });

    case 'anthropic':
    case 'claude':
      return new AnthropicProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
      });

    case 'gemini':
      return new GeminiProvider({
        apiKey: config.apiKey,
        model: config.model,
      });

    case 'none':
    default:
      return new NoopLLMProvider();
  }
}

```

## packages/ranking/src/__tests__/ranking.test.ts
```typescript
import { describe, it, expect } from 'vitest';
import { Ranker } from '../index.js';
import { defaultConfig } from '@codeatlas/core';
import type { RetrievalCandidate } from '@codeatlas/core';

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

```

## packages/retrieval/src/retrieval-engine.ts
```typescript
import type { FileInfo, RetrievalCandidate, RetrievalSource } from '@codeatlas/core';
import type { SearchRepository } from '@codeatlas/storage';
import { DependencyGraph } from '@codeatlas/graph';
import { createLogger } from '@codeatlas/shared';

const logger = createLogger('retrieval');

export type { RetrievalCandidate, RetrievalSource };

export interface RetrievalResult {
  candidates: RetrievalCandidate[];
  queryTerms: string[];
  duration: number;
}

export class RetrievalEngine {
  constructor(
    private searchRepo: SearchRepository,
    private graph: DependencyGraph,
    private filesByPath: Map<string, FileInfo>,
  ) {}

  retrieve(query: string, limit: number = 50): RetrievalResult {
    const startTime = Date.now();
    const queryTerms = this.extractTerms(query);
    const candidateMap = new Map<string, RetrievalCandidate>();

    // 1. Keyword retrieval via FTS5
    const ftsResults = this.searchRepo.searchFiles(query, limit);
    for (const result of ftsResults) {
      this.addCandidate(candidateMap, result.relativePath, {
        type: 'keyword',
        score: Math.max(1.0, 5.0 + Math.abs(result.rank ?? 0)),
        detail: `FTS match (rank: ${(result.rank ?? 0).toFixed(2)})`,
      });
    }

    // 2. Path-based retrieval
    for (const [filePath] of this.filesByPath) {
      const pathScore = this.scorePathMatch(filePath, queryTerms);
      if (pathScore > 0) {
        this.addCandidate(candidateMap, filePath, {
          type: 'path',
          score: pathScore,
          detail: `Path contains query terms`,
        });
      }
    }

    // 3. Graph expansion — expand from matched files
    const matchedFiles = [...candidateMap.keys()];
    for (const filePath of matchedFiles) {
      const deps = this.graph.getDependencies(filePath, 1);
      for (const dep of deps) {
        this.addCandidate(candidateMap, dep, {
          type: 'graph',
          score: 0.5,
          detail: `Dependency of ${filePath.split('/').pop()}`,
        });
      }

      const dependents = this.graph.getDependents(filePath, 1);
      for (const dep of dependents) {
        this.addCandidate(candidateMap, dep, {
          type: 'graph',
          score: 0.4,
          detail: `Dependent on ${filePath.split('/').pop()}`,
        });
      }
    }

    // Attach file info
    for (const candidate of candidateMap.values()) {
      candidate.file = this.filesByPath.get(candidate.filePath);
    }

    // Sort by combined source scores
    const candidates = [...candidateMap.values()]
      .sort((a, b) => {
        const scoreA = a.sources.reduce((sum, s) => sum + s.score, 0);
        const scoreB = b.sources.reduce((sum, s) => sum + s.score, 0);
        return scoreB - scoreA;
      })
      .slice(0, limit);

    const duration = Date.now() - startTime;
    logger.debug(`Retrieved ${candidates.length} candidates in ${duration}ms`);

    return { candidates, queryTerms, duration };
  }

  private addCandidate(
    map: Map<string, RetrievalCandidate>,
    filePath: string,
    source: RetrievalSource,
  ): void {
    const existing = map.get(filePath);
    if (existing) {
      existing.sources.push(source);
    } else {
      map.set(filePath, {
        filePath,
        sources: [source],
      });
    }
  }

  private extractTerms(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 1)
      .filter((term) => !STOP_WORDS.has(term));
  }

  private scorePathMatch(filePath: string, terms: string[]): number {
    const lowerPath = filePath.toLowerCase();
    let matchCount = 0;

    for (const term of terms) {
      if (lowerPath.includes(term)) {
        matchCount++;
      }
    }

    return terms.length > 0 ? matchCount / terms.length : 0;
  }
}

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'it',
  'to',
  'in',
  'on',
  'of',
  'for',
  'and',
  'or',
  'but',
  'not',
  'with',
  'this',
  'that',
  'from',
  'add',
  'fix',
  'make',
  'implement',
  'create',
  'update',
  'change',
  'new',
  'get',
  'set',
  'use',
  'do',
  'be',
]);

```

## packages/retrieval/src/__tests__/retrieval.test.ts
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RetrievalEngine } from '../index.js';
import { AtlasDatabase, runMigrations, FileRepository, SearchRepository } from '@codeatlas/storage';
import { DependencyGraph } from '@codeatlas/graph';
import type { FileInfo } from '@codeatlas/core';

describe('Multi-source Retrieval Engine', () => {
  let db: AtlasDatabase;

  beforeEach(() => {
    db = new AtlasDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('retrieves relevant files across FTS, path, and graph expansion', () => {
    const fileRepo = new FileRepository(db);
    const searchRepo = new SearchRepository(db);

    const projRes = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'test-app', '/test');
    const projectId = Number(projRes.lastInsertRowid);

    const authFileId = fileRepo.upsert(projectId, {
      path: '/test/src/auth/auth.service.ts',
      relativePath: 'src/auth/auth.service.ts',
      extension: '.ts',
      language: 'typescript',
      size: 500,
      hash: 'h1',
      module: 'src/auth',
      isTest: false,
      isGenerated: false,
      symbolCount: 2,
      importCount: 1,
      exportCount: 1,
    });

    const userFileId = fileRepo.upsert(projectId, {
      path: '/test/src/users/user.service.ts',
      relativePath: 'src/users/user.service.ts',
      extension: '.ts',
      language: 'typescript',
      size: 500,
      hash: 'h2',
      module: 'src/users',
      isTest: false,
      isGenerated: false,
      symbolCount: 2,
      importCount: 0,
      exportCount: 1,
    });

    searchRepo.indexFile(
      authFileId,
      'src/auth/auth.service.ts',
      'OAuth login with Google authentication provider',
    );
    searchRepo.indexFile(userFileId, 'src/users/user.service.ts', 'User repository entity store');

    const graph = new DependencyGraph();
    graph.addEdge({
      source: 'src/auth/auth.service.ts',
      target: 'src/users/user.service.ts',
      kind: 'import',
      symbols: ['UserService'],
      weight: 1.0,
    });

    const files = fileRepo.getAll(projectId);
    const filesByPath = new Map<string, FileInfo>(files.map((f) => [f.relativePath, f]));

    const retrieval = new RetrievalEngine(searchRepo, graph, filesByPath);
    const result = retrieval.retrieve('Google OAuth login');

    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    expect(result.candidates[0]?.filePath).toBe('src/auth/auth.service.ts');

    // UserService should be retrieved via graph expansion
    const userCandidate = result.candidates.find((c) => c.filePath === 'src/users/user.service.ts');
    expect(userCandidate).toBeDefined();
    expect(userCandidate?.sources.some((s) => s.type === 'graph')).toBe(true);
  });
});

```

## README.md
```markdown

```


## packages/core/src/models.ts
```typescript
export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'json'
  | 'yaml'
  | 'toml'
  | 'markdown'
  | 'html'
  | 'css'
  | 'scss'
  | 'sql'
  | 'shell'
  | 'dockerfile'
  | 'unknown';

export type SymbolKind =
  | 'class'
  | 'function'
  | 'method'
  | 'interface'
  | 'type'
  | 'enum'
  | 'struct'
  | 'trait'
  | 'variable'
  | 'constant'
  | 'property'
  | 'export';

export type DependencyKind = 'import' | 'export' | 'extends' | 'implements' | 'reference';

export type ContextMode = 'full' | 'signature' | 'summary' | 'digest';

export type RuleSource =
  | 'agents.md'
  | 'claude.md'
  | 'gemini.md'
  | 'cursor'
  | 'copilot'
  | 'atlas'
  | 'custom'
  | 'trae'
  | 'deepseek'
  | 'qwen'
  | 'lingma'
  | 'comate'
  | 'codegeex'
  | 'kimi'
  | 'grok'
  | 'replit'
  | 'devin'
  | 'opencode'
  | 'vellum'
  | 'openhands'
  | 'continue'
  | 'roo'
  | 'augment'
  | 'amazonq';

export type ExportTarget =
  | 'markdown'
  | 'claude'
  | 'cursor'
  | 'copilot'
  | 'gemini'
  | 'agents'
  | 'antigravity'
  | 'codex'
  | 'aider'
  | 'windsurf'
  | 'cline'
  | 'trae'
  | 'deepseek'
  | 'qwen'
  | 'lingma'
  | 'comate'
  | 'codegeex'
  | 'kimi'
  | 'grok'
  | 'replit'
  | 'devin'
  | 'opencode'
  | 'vellum'
  | 'openhands'
  | 'continue'
  | 'roo'
  | 'augment'
  | 'amazonq';

export type RuleScope = 'global' | 'path' | 'file';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

export type Framework =
  | 'next'
  | 'react'
  | 'vue'
  | 'svelte'
  | 'angular'
  | 'express'
  | 'fastify'
  | 'nestjs'
  | 'django'
  | 'flask'
  | 'spring'
  | 'unknown';

export interface ProjectMeta {
  name: string;
  root: string;
  languages: Language[];
  frameworks: Framework[];
  packageManager: PackageManager;
  fileCount: number;
  symbolCount: number;
  dependencyCount: number;
  isMonorepo: boolean;
  workspaces: string[];
}

export interface FileInfo {
  id?: number;
  path: string;
  relativePath: string;
  extension: string;
  language: Language;
  size: number;
  hash: string;
  module: string;
  isTest: boolean;
  isGenerated: boolean;
  symbolCount: number;
  importCount: number;
  exportCount: number;
  lastModified?: number;
}

export interface SymbolInfo {
  id?: number;
  name: string;
  kind: SymbolKind;
  filePath: string;
  line: number;
  endLine?: number;
  column: number;
  exported: boolean;
  signature?: string;
  parentSymbol?: string;
}

export interface ImportInfo {
  id?: number;
  filePath: string;
  importPath: string;
  resolvedPath?: string;
  symbols: string[];
  isDefault: boolean;
  isNamespace: boolean;
  isType: boolean;
}

export interface DependencyEdge {
  source: string;
  target: string;
  kind: DependencyKind;
  symbols: string[];
  weight: number;
}

export interface Rule {
  id: string;
  source: RuleSource;
  scope: RuleScope;
  filePath: string;
  content: string;
  priority: number;
  pathPattern?: string;
  agentTarget?: string;
}

export interface RuleConflict {
  ruleA: Rule;
  ruleB: Rule;
  reason: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface ScoreExplanation {
  signal: string;
  score: number;
  weight: number;
  reason: string;
}

export interface RetrievalSource {
  type: 'keyword' | 'symbol' | 'path' | 'graph';
  score: number;
  detail: string;
}

export interface RetrievalCandidate {
  filePath: string;
  file?: FileInfo;
  sources: RetrievalSource[];
  ftsRank?: number;
}

export interface ContextFile {
  path: string;
  relativePath: string;
  language: Language;
  relevance: number;
  mode: ContextMode;
  content: string;
  tokenCount: number;
  reasons: ScoreExplanation[];
}

export interface ContextPack {
  task: string;
  timestamp: string;
  repository: ProjectMeta;
  architecture?: string;
  repositoryMap?: string;
  rules: Rule[];
  files: ContextFile[];
  tokenBudget: number;
  tokenUsage: number;
  tokenBreakdown: {
    architecture: number;
    rules: number;
    repositoryMap: number;
    code: number;
  };
  retrievalStats: {
    candidateCount: number;
    selectedCount: number;
    searchTimeMs: number;
    rankingTimeMs: number;
    totalTimeMs: number;
  };
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  score: number;
  message: string;
  details?: string;
}

export interface HealthReport {
  overallScore: number;
  checks: HealthCheck[];
  categories: {
    architecture: number;
    rules: number;
    coverage: number;
    freshness: number;
    consistency: number;
    tokenEfficiency: number;
  };
}

export interface ScanResult {
  project: ProjectMeta;
  detectedFiles: number;
  skippedFiles: number;
  detectedLanguages: Map<Language, number>;
  detectedFrameworks: Framework[];
  detectedPackageManager: PackageManager;
  isMonorepo: boolean;
  workspaces: string[];
  hasTests: boolean;
  hasDocs: boolean;
  hasCI: boolean;
  duration: number;
}

export interface IndexState {
  lastIndexed: number;
  fileCount: number;
  symbolCount: number;
  importCount: number;
  version: string;
  hash: string;
}

```

## packages/exporters/src/exporters.ts
```typescript
import type { ContextPack, ExportTarget } from '@codeatlas/core';

export { type ExportTarget };

export interface ExportOptions {
  target: ExportTarget;
  outputPath?: string;
  merge?: boolean;
}

export interface Exporter {
  export(pack: ContextPack, options: ExportOptions): string;
  defaultFilename(): string;
}

function formatRules(pack: ContextPack): string[] {
  const lines: string[] = [];
  if (pack.rules.length > 0) {
    for (const rule of pack.rules) {
      lines.push(rule.content);
      lines.push('');
    }
  }
  return lines;
}

function formatFiles(pack: ContextPack): string[] {
  const lines: string[] = [];
  for (const file of pack.files) {
    lines.push(`## ${file.relativePath}`);
    lines.push('```' + file.language);
    lines.push(file.content);
    lines.push('```');
    lines.push('');
  }
  return lines;
}

export class MarkdownExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];

    lines.push(`# Context Pack: ${pack.task}`);
    lines.push('');
    lines.push(`> Generated by CodeAtlas at ${pack.timestamp}`);
    lines.push('');

    lines.push('## Repository');
    lines.push('');
    lines.push(`- **Name**: ${pack.repository.name}`);
    lines.push(`- **Languages**: ${pack.repository.languages.join(', ')}`);
    lines.push(`- **Frameworks**: ${pack.repository.frameworks.join(', ') || 'none detected'}`);
    lines.push(`- **Files**: ${pack.repository.fileCount}`);
    lines.push('');

    lines.push('## Token Budget');
    lines.push('');
    lines.push(`| Category | Tokens |`);
    lines.push(`|----------|--------|`);
    lines.push(`| Rules | ${pack.tokenBreakdown.rules.toLocaleString()} |`);
    lines.push(`| Repository Map | ${pack.tokenBreakdown.repositoryMap.toLocaleString()} |`);
    lines.push(`| Code | ${pack.tokenBreakdown.code.toLocaleString()} |`);
    lines.push(
      `| **Total** | **${pack.tokenUsage.toLocaleString()} / ${pack.tokenBudget.toLocaleString()}** |`,
    );
    lines.push('');

    if (pack.rules.length > 0) {
      lines.push('## Applicable Rules');
      lines.push('');
      for (const rule of pack.rules) {
        lines.push(`### From \`${rule.filePath}\` (${rule.source}, priority: ${rule.priority})`);
        lines.push('');
        lines.push(rule.content);
        lines.push('');
      }
    }

    if (pack.repositoryMap) {
      lines.push('## Repository Map');
      lines.push('');
      lines.push('```');
      lines.push(pack.repositoryMap);
      lines.push('```');
      lines.push('');
    }

    lines.push('## Relevant Files');
    lines.push('');

    for (const file of pack.files) {
      lines.push(`### \`${file.relativePath}\``);
      lines.push('');
      lines.push(
        `- **Language**: ${file.language} | **Mode**: ${file.mode} | **Relevance**: ${(file.relevance * 100).toFixed(0)}% | **Tokens**: ${file.tokenCount.toLocaleString()}`,
      );

      if (file.reasons.length > 0) {
        const reasonStr = file.reasons
          .map((r) => `${r.signal} (${(r.score * 100).toFixed(0)}%)`)
          .join(', ');
        lines.push(`- **Signals**: ${reasonStr}`);
      }

      lines.push('');
      lines.push('```' + file.language);
      lines.push(file.content);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'context-pack.md';
  }
}

export class ClaudeExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Project Context');
    lines.push('');
    lines.push(`> Generated for task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'CLAUDE.atlas.md';
  }
}

export class CursorExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Relevant Context');
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.cursorrules';
  }
}

export class CopilotExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# GitHub Copilot Context');
    lines.push('');
    lines.push(`## Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.github/copilot-instructions.atlas.md';
  }
}

export class GeminiExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Gemini Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'GEMINI.atlas.md';
  }
}

export class AgentsExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Agents Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'AGENTS.atlas.md';
  }
}

export class AntigravityExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Antigravity Context Injection');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push(`Generated: ${pack.timestamp}`);
    lines.push('');
    lines.push('## Project Directives');
    lines.push(...formatRules(pack));
    lines.push('## Relevant Codebase Files');
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'ANTIGRAVITY.atlas.md';
  }
}

export class CodexExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push(`// Task: ${pack.task}`);
    lines.push(`// Context Pack: ${pack.files.length} files`);
    lines.push('');
    for (const rule of pack.rules) {
      lines.push(`// Rule: ${rule.content}`);
    }
    lines.push('');
    for (const file of pack.files) {
      lines.push(`// File: ${file.relativePath}`);
      lines.push(file.content);
      lines.push('');
    }
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'CODEX.atlas.md';
  }
}

export class AiderExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Aider Context Instructions');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.aider.atlas.md';
  }
}

export class WindsurfExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Windsurf Rules & Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.windsurfrules';
  }
}

export class ClineExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Cline Custom Instructions & Context');
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.clinerules';
  }
}

export class TraeExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# ByteDance Trae Workspace Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.traerules';
  }
}

export class DeepSeekExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# DeepSeek Coder Context Pack');
    lines.push('');
    lines.push(`## Task Objective\n${pack.task}\n`);
    lines.push('## Coding Directives & Rules');
    lines.push(...formatRules(pack));
    lines.push('## Codebase Context Files');
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'DEEPSEEK.atlas.md';
  }
}

export class QwenExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Alibaba Tongyi Lingma / Qwen Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.lingmarules';
  }
}

export class ComateExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Baidu Comate AI Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.comaterules';
  }
}

export class CodeGeeXExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Zhipu AI CodeGeeX Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.codegeexrules';
  }
}

export class KimiExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Moonshot Kimi Code Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'KIMI.atlas.md';
  }
}

export class GrokExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# xAI Grok Build Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'GROK.atlas.md';
  }
}

export class ReplitExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Replit Agent Project Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'REPLIT.atlas.md';
  }
}

export class DevinExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Cognition Devin Workspace Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'DEVIN.atlas.md';
  }
}

export class OpenCodeExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# OpenCode AI Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'OPENCODE.atlas.md';
  }
}

export class VellumExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Vellum AI Context Injection');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'VELLUM.atlas.md';
  }
}

export class OpenHandsExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# OpenHands (OpenDevin) Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'OPENHANDS.atlas.md';
  }
}

export class ContinueExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Continue.dev Context Rules');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.continue/rules.atlas.md';
  }
}

export class RooExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Roo Code Context & Custom Rules');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.roorules';
  }
}

export class AugmentExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Augment Code Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.augmentrules';
  }
}

export class AmazonQExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('# Amazon Q Developer Context');
    lines.push('');
    lines.push(`Task: ${pack.task}`);
    lines.push('');
    lines.push(...formatRules(pack));
    lines.push(...formatFiles(pack));
    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'AMAZONQ.atlas.md';
  }
}

export function createExporter(target: ExportTarget): Exporter {
  switch (target) {
    case 'markdown':
      return new MarkdownExporter();
    case 'claude':
      return new ClaudeExporter();
    case 'cursor':
      return new CursorExporter();
    case 'copilot':
      return new CopilotExporter();
    case 'gemini':
      return new GeminiExporter();
    case 'agents':
      return new AgentsExporter();
    case 'antigravity':
      return new AntigravityExporter();
    case 'codex':
      return new CodexExporter();
    case 'aider':
      return new AiderExporter();
    case 'windsurf':
      return new WindsurfExporter();
    case 'cline':
      return new ClineExporter();
    case 'trae':
      return new TraeExporter();
    case 'deepseek':
      return new DeepSeekExporter();
    case 'qwen':
    case 'lingma':
      return new QwenExporter();
    case 'comate':
      return new ComateExporter();
    case 'codegeex':
      return new CodeGeeXExporter();
    case 'kimi':
      return new KimiExporter();
    case 'grok':
      return new GrokExporter();
    case 'replit':
      return new ReplitExporter();
    case 'devin':
      return new DevinExporter();
    case 'opencode':
      return new OpenCodeExporter();
    case 'vellum':
      return new VellumExporter();
    case 'openhands':
      return new OpenHandsExporter();
    case 'continue':
      return new ContinueExporter();
    case 'roo':
      return new RooExporter();
    case 'augment':
      return new AugmentExporter();
    case 'amazonq':
      return new AmazonQExporter();
    default:
      return new MarkdownExporter();
  }
}

```

## packages/exporters/src/__tests__/exporters.test.ts
```typescript
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
    expect(md.export(samplePack, { target: 'markdown' })).toContain('# Context Pack: Add Google OAuth login');

    const claude = createExporter('claude');
    expect(claude.export(samplePack, { target: 'claude' })).toContain('# Project Context');

    const cursor = createExporter('cursor');
    expect(cursor.export(samplePack, { target: 'cursor' })).toContain('# Relevant Context');

    const antigravity = createExporter('antigravity');
    expect(antigravity.export(samplePack, { target: 'antigravity' })).toContain('# Antigravity Context Injection');
  });

  it('exports to Chinese AI coding agents (Trae, DeepSeek, Qwen/Lingma, Comate, CodeGeeX, Kimi)', () => {
    const trae = createExporter('trae');
    expect(trae.export(samplePack, { target: 'trae' })).toContain('# ByteDance Trae Workspace Context');
    expect(trae.defaultFilename()).toBe('.traerules');

    const deepseek = createExporter('deepseek');
    expect(deepseek.export(samplePack, { target: 'deepseek' })).toContain('# DeepSeek Coder Context Pack');
    expect(deepseek.defaultFilename()).toBe('DEEPSEEK.atlas.md');

    const qwen = createExporter('qwen');
    expect(qwen.export(samplePack, { target: 'qwen' })).toContain('# Alibaba Tongyi Lingma / Qwen Context');
    expect(qwen.defaultFilename()).toBe('.lingmarules');

    const comate = createExporter('comate');
    expect(comate.export(samplePack, { target: 'comate' })).toContain('# Baidu Comate AI Context');
    expect(comate.defaultFilename()).toBe('.comaterules');

    const codegeex = createExporter('codegeex');
    expect(codegeex.export(samplePack, { target: 'codegeex' })).toContain('# Zhipu AI CodeGeeX Context');
    expect(codegeex.defaultFilename()).toBe('.codegeexrules');

    const kimi = createExporter('kimi');
    expect(kimi.export(samplePack, { target: 'kimi' })).toContain('# Moonshot Kimi Code Context');
    expect(kimi.defaultFilename()).toBe('KIMI.atlas.md');
  });

  it('exports to global AI coding agents (Grok, Replit, Devin, OpenHands, OpenCode, Vellum, Continue, Roo, Augment, AmazonQ)', () => {
    const grok = createExporter('grok');
    expect(grok.export(samplePack, { target: 'grok' })).toContain('# xAI Grok Build Context');

    const replit = createExporter('replit');
    expect(replit.export(samplePack, { target: 'replit' })).toContain('# Replit Agent Project Context');

    const devin = createExporter('devin');
    expect(devin.export(samplePack, { target: 'devin' })).toContain('# Cognition Devin Workspace Context');

    const openhands = createExporter('openhands');
    expect(openhands.export(samplePack, { target: 'openhands' })).toContain('# OpenHands (OpenDevin) Context');

    const opencode = createExporter('opencode');
    expect(opencode.export(samplePack, { target: 'opencode' })).toContain('# OpenCode AI Context');

    const vellum = createExporter('vellum');
    expect(vellum.export(samplePack, { target: 'vellum' })).toContain('# Vellum AI Context Injection');

    const cont = createExporter('continue');
    expect(cont.export(samplePack, { target: 'continue' })).toContain('# Continue.dev Context Rules');

    const roo = createExporter('roo');
    expect(roo.export(samplePack, { target: 'roo' })).toContain('# Roo Code Context & Custom Rules');

    const augment = createExporter('augment');
    expect(augment.export(samplePack, { target: 'augment' })).toContain('# Augment Code Context');

    const amazonq = createExporter('amazonq');
    expect(amazonq.export(samplePack, { target: 'amazonq' })).toContain('# Amazon Q Developer Context');
  });
});

```

## packages/llm/src/llm-provider.ts
```typescript
import { createLogger } from '@codeatlas/shared';

const logger = createLogger('llm');

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  systemPrompt?: string;
}

export interface LLMProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export interface LLMProvider {
  name: string;
  complete(prompt: string, options?: LLMOptions): Promise<string>;
  isAvailable(): boolean;
}

export class NoopLLMProvider implements LLMProvider {
  name = 'none';

  async complete(_prompt: string, _options?: LLMOptions): Promise<string> {
    return '';
  }

  isAvailable(): boolean {
    return false;
  }
}

export class OpenAiCompatibleProvider implements LLMProvider {
  public name: string;
  protected apiKey: string;
  protected baseUrl: string;
  protected defaultModel: string;
  protected timeoutMs: number;

  constructor(config: {
    name: string;
    apiKey?: string;
    baseUrl: string;
    defaultModel: string;
    timeoutMs?: number;
  }) {
    this.name = config.name;
    this.apiKey = config.apiKey ?? '';
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.defaultModel = config.defaultModel;
    this.timeoutMs = config.timeoutMs ?? 30000;
  }

  isAvailable(): boolean {
    return this.name === 'ollama' || Boolean(this.apiKey);
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const model = options?.model ?? this.defaultModel;

    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const body = {
      model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 2048,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content?.trim() ?? '';
    } catch (err) {
      logger.warn(`LLM completion failed for ${this.name}:`, err);
      throw err;
    }
  }
}

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = config.apiKey ?? process.env['ANTHROPIC_API_KEY'] ?? '';
    this.baseUrl = (config.baseUrl ?? 'https://api.anthropic.com/v1').replace(/\/$/, '');
    this.defaultModel = config.model ?? 'claude-3-5-haiku-latest';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const url = `${this.baseUrl}/messages`;
    const model = options?.model ?? this.defaultModel;

    const body = {
      model,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.2,
      system: options?.systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic HTTP ${res.status}: ${err}`);
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      return data.content?.[0]?.text?.trim() ?? '';
    } catch (err) {
      logger.warn('Anthropic completion failed:', err);
      throw err;
    }
  }
}

export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  private apiKey: string;
  private defaultModel: string;

  constructor(config: { apiKey?: string; model?: string }) {
    this.apiKey = config.apiKey ?? process.env['GEMINI_API_KEY'] ?? process.env['GOOGLE_API_KEY'] ?? '';
    this.defaultModel = config.model ?? 'gemini-2.0-flash';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const model = options?.model ?? this.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxTokens ?? 2048,
      },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${err}`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    } catch (err) {
      logger.warn('Gemini completion failed:', err);
      throw err;
    }
  }
}

export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  const provider = config.provider.toLowerCase();

  switch (provider) {
    case 'deepseek':
      return new OpenAiCompatibleProvider({
        name: 'deepseek',
        apiKey: config.apiKey ?? process.env['DEEPSEEK_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://api.deepseek.com/v1',
        defaultModel: config.model ?? 'deepseek-chat',
      });

    case 'qwen':
    case 'lingma':
    case 'dashscope':
      return new OpenAiCompatibleProvider({
        name: 'qwen',
        apiKey: config.apiKey ?? process.env['DASHSCOPE_API_KEY'] ?? process.env['QWEN_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        defaultModel: config.model ?? 'qwen-plus',
      });

    case 'kimi':
    case 'moonshot':
      return new OpenAiCompatibleProvider({
        name: 'kimi',
        apiKey: config.apiKey ?? process.env['MOONSHOT_API_KEY'] ?? process.env['KIMI_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://api.moonshot.cn/v1',
        defaultModel: config.model ?? 'moonshot-v1-8k',
      });

    case 'grok':
    case 'xai':
      return new OpenAiCompatibleProvider({
        name: 'grok',
        apiKey: config.apiKey ?? process.env['XAI_API_KEY'] ?? process.env['GROK_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://api.x.ai/v1',
        defaultModel: config.model ?? 'grok-beta',
      });

    case 'ollama':
      return new OpenAiCompatibleProvider({
        name: 'ollama',
        apiKey: 'ollama',
        baseUrl: config.baseUrl ?? 'http://localhost:11434/v1',
        defaultModel: config.model ?? 'qwen2.5-coder:7b',
      });

    case 'openai':
      return new OpenAiCompatibleProvider({
        name: 'openai',
        apiKey: config.apiKey ?? process.env['OPENAI_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://api.openai.com/v1',
        defaultModel: config.model ?? 'gpt-4o-mini',
      });

    case 'anthropic':
    case 'claude':
      return new AnthropicProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
      });

    case 'gemini':
      return new GeminiProvider({
        apiKey: config.apiKey,
        model: config.model,
      });

    case 'none':
    default:
      return new NoopLLMProvider();
  }
}

```

## packages/ranking/src/__tests__/ranking.test.ts
```typescript
import { describe, it, expect } from 'vitest';
import { Ranker } from '../index.js';
import { defaultConfig } from '@codeatlas/core';
import type { RetrievalCandidate } from '@codeatlas/core';

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

```

## packages/retrieval/src/retrieval-engine.ts
```typescript
import type { FileInfo, RetrievalCandidate, RetrievalSource } from '@codeatlas/core';
import type { SearchRepository } from '@codeatlas/storage';
import { DependencyGraph } from '@codeatlas/graph';
import { createLogger } from '@codeatlas/shared';
const logger = createLogger('retrieval');
export type { RetrievalCandidate, RetrievalSource };
export interface RetrievalResult {
export class RetrievalEngine {
    private searchRepo: SearchRepository,
    private graph: DependencyGraph,
    private filesByPath: Map<string, FileInfo>,
    const startTime = Date.now();
    const queryTerms = this.extractTerms(query);
    const candidateMap = new Map<string, RetrievalCandidate>();
    const ftsResults = this.searchRepo.searchFiles(query, limit);
      const pathScore = this.scorePathMatch(filePath, queryTerms);
    const matchedFiles = [...candidateMap.keys()];
      const deps = this.graph.getDependencies(filePath, 1);
      const dependents = this.graph.getDependents(filePath, 1);
    const candidates = [...candidateMap.values()]
        const scoreA = a.sources.reduce((sum, s) => sum + s.score, 0);
        const scoreB = b.sources.reduce((sum, s) => sum + s.score, 0);
    const duration = Date.now() - startTime;
  private addCandidate(
    const existing = map.get(filePath);
  private extractTerms(query: string): string[] {
  private scorePathMatch(filePath: string, terms: string[]): number {
    const lowerPath = filePath.toLowerCase();
const STOP_WORDS = new Set([
```

## packages/retrieval/src/__tests__/retrieval.test.ts
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RetrievalEngine } from '../index.js';
import { AtlasDatabase, runMigrations, FileRepository, SearchRepository } from '@codeatlas/storage';
import { DependencyGraph } from '@codeatlas/graph';
import type { FileInfo } from '@codeatlas/core';
    const fileRepo = new FileRepository(db);
    const searchRepo = new SearchRepository(db);
    const projRes = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'test-app', '/test');
    const projectId = Number(projRes.lastInsertRowid);
    const authFileId = fileRepo.upsert(projectId, {
    const userFileId = fileRepo.upsert(projectId, {
    const graph = new DependencyGraph();
    const files = fileRepo.getAll(projectId);
    const filesByPath = new Map<string, FileInfo>(files.map((f) => [f.relativePath, f]));
    const retrieval = new RetrievalEngine(searchRepo, graph, filesByPath);
    const result = retrieval.retrieve('Google OAuth login');
    const userCandidate = result.candidates.find((c) => c.filePath === 'src/users/user.service.ts');
```

## README.md
```markdown

```

# Antigravity Context Injection

> Task Goal: Support Python and Go

## Agent Rules & Instructions

# CodeAtlas AI Instructions

- Always write strictly-typed TypeScript with TypeScript 5.x.
- Keep packages decoupled and communicate through domain models in `@codeatlas/core`.
- Maintain 100% test pass rate with Vitest.
- Follow local-first privacy principles: never upload repository code without user consent.


# Relevant Context

## packages/token-counter/package.json

```json
{
  "name": "@codeatlas/token-counter",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist"
  },
  "dependencies": {
    "@codeatlas/shared": "workspace:*",
    "@codeatlas/core": "workspace:*"
  }
}

```

## packages/token-counter/src/index.ts

```typescript
export { TokenCounter, createTokenCounter } from './token-counter.js';

```

## packages/token-counter/src/token-counter.ts

```typescript
export class TokenCounter {
  private readonly avgCharsPerToken: number;

  constructor(avgCharsPerToken: number = 4) {
    this.avgCharsPerToken = avgCharsPerToken;
  }

  count(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / this.avgCharsPerToken);
  }

  countLines(lines: string[]): number {
    return this.count(lines.join('\n'));
  }

  fitWithinBudget(text: string, budget: number): string {
    const tokens = this.count(text);
    if (tokens <= budget) return text;

    const targetChars = budget * this.avgCharsPerToken;
    return text.slice(0, targetChars);
  }

  remaining(budget: number, used: number): number {
    return Math.max(0, budget - used);
  }
}

export function createTokenCounter(): TokenCounter {
  return new TokenCounter();
}

```

## packages/token-counter/src/__tests__/token-counter.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { TokenCounter, createTokenCounter } from '../index.js';

describe('Token Counter', () => {
  it('estimates token counts and manages budget limits', () => {
    const counter = createTokenCounter();

    const sample = 'export class AuthService { async login() { return true; } }';
    const tokens = counter.count(sample);
    expect(tokens).toBeGreaterThan(10);

    expect(counter.remaining(1000, 400)).toBe(600);
    expect(counter.remaining(1000, 1200)).toBe(0);

    const truncated = counter.fitWithinBudget('abcdefghijklmnopqrstuvwxyz', 3);
    expect(truncated.length).toBeLessThanOrEqual(12);
  });
});

```

## packages/token-counter/tsconfig.json

```json
﻿{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}

```

## packages/token-counter/tsup.config.ts

```typescript
﻿import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});

```

## apps/cli/package.json

```json
{
  "name": "@codeatlas/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "atlas": "./dist/index.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist",
    "atlas": "node --enable-source-maps ./dist/index.js"
  },
  "dependencies": {
    "@codeatlas/shared": "workspace:*",
    "@codeatlas/core": "workspace:*",
    "@codeatlas/storage": "workspace:*",
    "@codeatlas/git": "workspace:*",
    "@codeatlas/parser": "workspace:*",
    "@codeatlas/indexer": "workspace:*",
    "@codeatlas/graph": "workspace:*",
    "@codeatlas/retrieval": "workspace:*",
    "@codeatlas/ranking": "workspace:*",
    "@codeatlas/token-counter": "workspace:*",
    "@codeatlas/context": "workspace:*",
    "@codeatlas/rules": "workspace:*",
    "@codeatlas/exporters": "workspace:*",
    "@codeatlas/llm": "workspace:*",
    "commander": "^12.1.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0"
  }
}

```

## apps/cli/src/commands/context.ts

```typescript
import type { Command } from 'commander';
import chalk from 'chalk';
import { ensureInitialized, openDatabase, getOrCreateProject, loadConfig } from '../utils.js';
import { FileRepository, SearchRepository, DependencyRepository } from '@codeatlas/storage';
import { DependencyGraph } from '@codeatlas/graph';
import { RetrievalEngine } from '@codeatlas/retrieval';
import { Ranker } from '@codeatlas/ranking';
import { ContextEngine } from '@codeatlas/context';
import { RuleEngine } from '@codeatlas/rules';
import type { FileInfo, ProjectMeta } from '@codeatlas/core';

export function registerContextCommand(program: Command): void {
  program
    .command('context <task>')
    .description('Generate context pack for a coding task')
    .option('--budget <tokens>', 'Token budget', '12000')
    .option('--limit <n>', 'Max files', '30')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed scoring')
    .action(async (task: string, options: { budget: string; limit: string; json?: boolean; verbose?: boolean }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const config = loadConfig(cwd);
      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);

      // Load file index
      const fileRepo = new FileRepository(db);
      const files = fileRepo.getAll(projectId);
      const filesByPath = new Map<string, FileInfo>(files.map((f) => [f.relativePath, f]));

      // Load dependency graph
      const depRepo = new DependencyRepository(db);
      const deps = depRepo.getAll(projectId);
      const graph = new DependencyGraph();
      graph.addEdges(deps);

      // Load search
      const searchRepo = new SearchRepository(db);

      // Retrieve
      const retrieval = new RetrievalEngine(searchRepo, graph, filesByPath);
      const retrievalResult = retrieval.retrieve(task, parseInt(options.limit, 10));

      // Rank
      const ranker = new Ranker({
        weights: config.ranking,
        queryTerms: retrievalResult.queryTerms,
      });
      const ranked = ranker.rank(retrievalResult.candidates);

      // Discover rules
      const ruleEngine = new RuleEngine(cwd);
      const rules = ruleEngine.discover();

      // Build context pack
      const project = db.get<Record<string, unknown>>(
        'SELECT * FROM projects WHERE id = ?',
        projectId,
      );

      const projectMeta: ProjectMeta = {
        name: (project?.['name'] as string) ?? '',
        root: cwd.replace(/\\/g, '/'),
        languages: JSON.parse((project?.['languages'] as string) ?? '[]') as ProjectMeta['languages'],
        frameworks: JSON.parse((project?.['frameworks'] as string) ?? '[]') as ProjectMeta['frameworks'],
        packageManager: (project?.['package_manager'] as ProjectMeta['packageManager']) ?? 'unknown',
        fileCount: files.length,
        symbolCount: 0,
        dependencyCount: deps.length,
        isMonorepo: (project?.['is_monorepo'] as number) === 1,
        workspaces: JSON.parse((project?.['workspaces'] as string) ?? '[]') as string[],
      };

      const budget = parseInt(options.budget, 10) || config.context.max_tokens;
      const contextEngine = new ContextEngine({
        tokenBudget: budget,
        defaultMode: config.context.default_mode,
        repositoryRoot: cwd,
      });

      const contextPack = contextEngine.build({
        task,
        project: projectMeta,
        rankedResults: ranked,
        rules,
      });

      db.close();

      if (options.json) {
        console.log(JSON.stringify(contextPack, null, 2));
        return;
      }

      // Display
      console.log('');
      console.log(chalk.bold(`Context Pack: "${task}"`));
      console.log('');

      console.log(chalk.bold('  Selected Files'));
      console.log('');
      for (const file of contextPack.files) {
        const pct = Math.round(file.relevance * 100);
        const bar = '█'.repeat(Math.ceil(pct / 5));
        const modeLabel = file.mode === 'full' ? '' : chalk.dim(` [${file.mode}]`);
        console.log(`  ${chalk.green(String(pct).padStart(3) + '%')}  ${chalk.cyan(bar.padEnd(20))} ${file.relativePath}${modeLabel} ${chalk.dim(`(${file.tokenCount} tokens)`)}`);

        if (options.verbose) {
          for (const reason of file.reasons) {
            console.log(`       ${chalk.dim('→ ' + reason.reason)}`);
          }
        }
      }

      console.log('');
      console.log(chalk.bold('  Token Budget'));
      console.log('');
      console.log(`  ${chalk.dim('Rules'.padEnd(20))} ${contextPack.tokenBreakdown.rules.toLocaleString().padStart(8)}`);
      console.log(`  ${chalk.dim('Repository map'.padEnd(20))} ${contextPack.tokenBreakdown.repositoryMap.toLocaleString().padStart(8)}`);
      console.log(`  ${chalk.dim('Code'.padEnd(20))} ${contextPack.tokenBreakdown.code.toLocaleString().padStart(8)}`);
      console.log(`  ${'─'.repeat(30)}`);
      console.log(`  ${chalk.bold('Total'.padEnd(20))} ${chalk.bold(contextPack.tokenUsage.toLocaleString().padStart(8))} / ${contextPack.tokenBudget.toLocaleString()}`);

      if (contextPack.rules.length > 0) {
        console.log('');
        console.log(chalk.bold(`  Rules (${contextPack.rules.length})`));
        for (const rule of contextPack.rules) {
          console.log(`    ${chalk.dim('●')} ${rule.filePath} ${chalk.dim(`[${rule.source}]`)}`);
        }
      }

      console.log('');
      console.log(chalk.dim(`  ${contextPack.retrievalStats.candidateCount} candidates → ${contextPack.retrievalStats.selectedCount} selected in ${contextPack.retrievalStats.totalTimeMs}ms`));
      console.log('');
    });
}

```

## apps/cli/src/commands/export.ts

```typescript
import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { ensureInitialized, openDatabase, getOrCreateProject, loadConfig } from '../utils.js';
import { FileRepository, SearchRepository, DependencyRepository } from '@codeatlas/storage';
import { DependencyGraph } from '@codeatlas/graph';
import { RetrievalEngine } from '@codeatlas/retrieval';
import { Ranker } from '@codeatlas/ranking';
import { ContextEngine } from '@codeatlas/context';
import { RuleEngine } from '@codeatlas/rules';
import { createExporter, type ExportTarget } from '@codeatlas/exporters';
import type { FileInfo, ProjectMeta } from '@codeatlas/core';

export function registerExportCommand(program: Command): void {
  program
    .command('export')
    .description('Export context pack to an AI agent format')
    .requiredOption('--target <target>', 'Export target: markdown, claude, cursor, copilot, gemini, agents')
    .option('--task <task>', 'Task for context generation', 'General project context')
    .option('--budget <tokens>', 'Token budget')
    .option('--output <path>', 'Output file path')
    .action(async (options: { target: string; task: string; budget?: string; output?: string }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const target = options.target as ExportTarget;
      const validTargets: ExportTarget[] = ['markdown', 'claude', 'cursor', 'copilot', 'gemini', 'agents'];
      if (!validTargets.includes(target)) {
        console.error(chalk.red(`Invalid target: ${options.target}`));
        console.error(chalk.dim(`Valid targets: ${validTargets.join(', ')}`));
        process.exit(1);
      }

      const config = loadConfig(cwd);
      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);

      const fileRepo = new FileRepository(db);
      const files = fileRepo.getAll(projectId);
      const filesByPath = new Map<string, FileInfo>(files.map((f) => [f.relativePath, f]));

      const depRepo = new DependencyRepository(db);
      const deps = depRepo.getAll(projectId);
      const graph = new DependencyGraph();
      graph.addEdges(deps);

      const searchRepo = new SearchRepository(db);
      const retrieval = new RetrievalEngine(searchRepo, graph, filesByPath);
      const retrievalResult = retrieval.retrieve(options.task);

      const ranker = new Ranker({ weights: config.ranking, queryTerms: retrievalResult.queryTerms });
      const ranked = ranker.rank(retrievalResult.candidates);

      const ruleEngine = new RuleEngine(cwd);
      const rules = ruleEngine.discover();

      const project = db.get<Record<string, unknown>>('SELECT * FROM projects WHERE id = ?', projectId);
      const projectMeta: ProjectMeta = {
        name: (project?.['name'] as string) ?? '',
        root: cwd.replace(/\\/g, '/'),
        languages: JSON.parse((project?.['languages'] as string) ?? '[]') as ProjectMeta['languages'],
        frameworks: JSON.parse((project?.['frameworks'] as string) ?? '[]') as ProjectMeta['frameworks'],
        packageManager: (project?.['package_manager'] as ProjectMeta['packageManager']) ?? 'unknown',
        fileCount: files.length,
        symbolCount: 0,
        dependencyCount: deps.length,
        isMonorepo: (project?.['is_monorepo'] as number) === 1,
        workspaces: JSON.parse((project?.['workspaces'] as string) ?? '[]') as string[],
      };

      const budget = parseInt(options.budget ?? '', 10) || config.context.max_tokens;
      const contextEngine = new ContextEngine({
        tokenBudget: budget,
        defaultMode: config.context.default_mode,
        repositoryRoot: cwd,
      });

      const contextPack = contextEngine.build({ task: options.task, project: projectMeta, rankedResults: ranked, rules });

      db.close();

      const exporter = createExporter(target);
      const content = exporter.export(contextPack, { target });
      const outputPath = options.output ?? path.join(cwd, exporter.defaultFilename());

      // Check for existing file
      if (fs.existsSync(outputPath) && !options.output) {
        const basename = path.basename(outputPath);
        console.log(chalk.yellow(`  Existing ${basename} detected.`));
        console.log(chalk.dim(`  Writing to ${basename.replace('.md', '.atlas.md')} instead.`));
        const altPath = outputPath.replace('.md', '.atlas.md').replace('.cursorrules', '.cursorrules.atlas');
        fs.writeFileSync(altPath, content, 'utf-8');
        console.log(chalk.green(`  ✓ Exported to ${path.relative(cwd, altPath)}`));
      } else {
        fs.writeFileSync(outputPath, content, 'utf-8');
        console.log(chalk.green(`  ✓ Exported to ${path.relative(cwd, outputPath)}`));
      }

      console.log(chalk.dim(`  ${contextPack.files.length} files, ${contextPack.tokenUsage.toLocaleString()} tokens`));
      console.log('');
    });
}

```

## apps/cli/src/utils.ts

```typescript
import fs from 'node:fs';
import path from 'node:path';
import type { AtlasConfig } from '@codeatlas/core';
import { defaultConfig } from '@codeatlas/core';
import { AtlasDatabase, runMigrations } from '@codeatlas/storage';

const ATLAS_DIR = '.atlas';
const CONFIG_FILE = 'config.toml';
const DB_FILE = 'index.db';

export function getAtlasDir(cwd: string = process.cwd()): string {
  return path.join(cwd, ATLAS_DIR);
}

export function getConfigPath(cwd: string = process.cwd()): string {
  return path.join(getAtlasDir(cwd), CONFIG_FILE);
}

export function getDbPath(cwd: string = process.cwd()): string {
  return path.join(getAtlasDir(cwd), DB_FILE);
}

export function isInitialized(cwd: string = process.cwd()): boolean {
  return fs.existsSync(getAtlasDir(cwd));
}

export function ensureInitialized(cwd: string = process.cwd()): void {
  if (!isInitialized(cwd)) {
    console.error('CodeAtlas is not initialized in this directory.');
    console.error('Run: atlas init');
    process.exit(1);
  }
}

export function openDatabase(cwd: string = process.cwd()): AtlasDatabase {
  const dbPath = getDbPath(cwd);
  const db = new AtlasDatabase(dbPath);
  runMigrations(db);
  return db;
}

export function loadConfig(cwd: string = process.cwd()): AtlasConfig {
  const configPath = getConfigPath(cwd);

  if (!fs.existsSync(configPath)) {
    return defaultConfig();
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = parseTOML(content);
    return { ...defaultConfig(), ...parsed } as AtlasConfig;
  } catch {
    return defaultConfig();
  }
}

export function getOrCreateProject(db: AtlasDatabase, cwd: string): number {
  const normalizedRoot = cwd.replace(/\\/g, '/');
  const existing = db.get<{ id: number }>(
    'SELECT id FROM projects WHERE root = ?',
    normalizedRoot,
  );

  if (existing) {
    return existing.id;
  }

  const name = path.basename(cwd);
  const result = db.run(
    'INSERT INTO projects (name, root) VALUES (?, ?)',
    name,
    normalizedRoot,
  );
  return Number(result.lastInsertRowid);
}

function parseTOML(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentSection: Record<string, unknown> = result;
  let currentSectionName = '';

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSectionName = sectionMatch[1] ?? '';
      currentSection = {};
      result[currentSectionName] = currentSection;
      continue;
    }

    const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1] ?? '';
      let value: unknown = kvMatch[2] ?? '';

      // Parse value
      const strValue = value as string;
      if (strValue === 'true') value = true;
      else if (strValue === 'false') value = false;
      else if (strValue.startsWith('"') && strValue.endsWith('"')) value = strValue.slice(1, -1);
      else if (strValue.startsWith("'") && strValue.endsWith("'")) value = strValue.slice(1, -1);
      else if (strValue.startsWith('[')) {
        try { value = JSON.parse(strValue.replace(/'/g, '"')); } catch { /* keep string */ }
      }
      else if (!isNaN(Number(strValue))) value = Number(strValue);

      if (key) {
        currentSection[key] = value;
      }
    }
  }

  return result;
}

export function generateConfigTOML(config: AtlasConfig): string {
  const lines: string[] = [];

  lines.push('[project]');
  lines.push(`name = "${config.project.name}"`);
  lines.push('');

  lines.push('[index]');
  lines.push(`follow_symlinks = ${config.index.follow_symlinks}`);
  lines.push(`include_tests = ${config.index.include_tests}`);
  lines.push(`max_file_size = ${config.index.max_file_size}`);
  lines.push('');

  lines.push('[context]');
  lines.push(`max_tokens = ${config.context.max_tokens}`);
  lines.push(`default_mode = "${config.context.default_mode}"`);
  lines.push('');

  lines.push('[ranking]');
  lines.push(`lexical_weight = ${config.ranking.lexical_weight}`);
  lines.push(`symbol_weight = ${config.ranking.symbol_weight}`);
  lines.push(`path_weight = ${config.ranking.path_weight}`);
  lines.push(`dependency_weight = ${config.ranking.dependency_weight}`);
  lines.push(`rule_weight = ${config.ranking.rule_weight}`);
  lines.push(`recency_weight = ${config.ranking.recency_weight}`);
  lines.push(`module_weight = ${config.ranking.module_weight}`);
  lines.push('');

  lines.push('[security]');
  lines.push(`scan_secrets = ${config.security.scan_secrets}`);
  lines.push(`exclude_patterns = ${JSON.stringify(config.security.exclude_patterns)}`);
  lines.push('');

  lines.push('[ai]');
  lines.push(`provider = "${config.ai.provider}"`);
  lines.push('');

  return lines.join('\n');
}

```

## packages/context/package.json

```json
{
  "name": "@codeatlas/context",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist"
  },
  "dependencies": {
    "@codeatlas/shared": "workspace:*",
    "@codeatlas/core": "workspace:*",
    "@codeatlas/retrieval": "workspace:*",
    "@codeatlas/ranking": "workspace:*",
    "@codeatlas/token-counter": "workspace:*",
    "@codeatlas/rules": "workspace:*"
  }
}

```

## packages/context/src/context-engine.ts

```typescript
import fs from 'node:fs';
import type { ContextPack, ContextFile, ProjectMeta, Rule, ContextMode } from '@codeatlas/core';
import type { RankedResult } from '@codeatlas/ranking';
import { TokenCounter } from '@codeatlas/token-counter';
import { createLogger } from '@codeatlas/shared';

const logger = createLogger('context');

export interface ContextEngineOptions {
  tokenBudget: number;
  defaultMode: ContextMode;
  repositoryRoot: string;
}

export interface ContextBuildInput {
  task: string;
  project: ProjectMeta;
  rankedResults: RankedResult[];
  rules: Rule[];
  repositoryMap?: string;
}

export class ContextEngine {
  private tokenCounter: TokenCounter;
  private options: ContextEngineOptions;

  constructor(options: ContextEngineOptions) {
    this.options = options;
    this.tokenCounter = new TokenCounter();
  }

  build(input: ContextBuildInput): ContextPack {
    const startTime = Date.now();

    let remainingTokens = this.options.tokenBudget;
    const tokenBreakdown = { architecture: 0, rules: 0, repositoryMap: 0, code: 0 };

    // 1. Reserve tokens for rules
    const rulesText = input.rules.map((r) => r.content).join('\n\n');
    const rulesTokens = this.tokenCounter.count(rulesText);
    const allocatedRulesTokens = Math.min(rulesTokens, Math.floor(remainingTokens * 0.15));
    tokenBreakdown.rules = allocatedRulesTokens;
    remainingTokens -= allocatedRulesTokens;

    // 2. Reserve tokens for repository map
    if (input.repositoryMap) {
      const mapTokens = this.tokenCounter.count(input.repositoryMap);
      const allocatedMapTokens = Math.min(mapTokens, Math.floor(remainingTokens * 0.15));
      tokenBreakdown.repositoryMap = allocatedMapTokens;
      remainingTokens -= allocatedMapTokens;
    }

    // 3. Fill remaining budget with code files
    const contextFiles: ContextFile[] = [];
    let codeTokensUsed = 0;

    for (const result of input.rankedResults) {
      if (remainingTokens <= 0) break;

      const filePath = result.filePath;
      const absPath = this.resolveAbsPath(filePath);

      let content: string;
      try {
        content = fs.readFileSync(absPath, 'utf-8');
      } catch {
        logger.debug(`Cannot read file for context: ${filePath}`);
        continue;
      }

      const fullTokens = this.tokenCounter.count(content);
      let mode: ContextMode = this.options.defaultMode;
      let finalContent = content;
      let tokenCount = fullTokens;

      // Downgrade mode if file is too large for budget
      if (fullTokens > remainingTokens) {
        // Try signature mode
        const sigContent = this.extractSignatures(content);
        const sigTokens = this.tokenCounter.count(sigContent);

        if (sigTokens <= remainingTokens) {
          mode = 'signature';
          finalContent = sigContent;
          tokenCount = sigTokens;
        } else {
          // Try digest mode
          const digestContent = this.createDigest(content, filePath);
          const digestTokens = this.tokenCounter.count(digestContent);

          if (digestTokens <= remainingTokens) {
            mode = 'digest';
            finalContent = digestContent;
            tokenCount = digestTokens;
          } else {
            continue;
          }
        }
      }

      contextFiles.push({
        path: absPath,
        relativePath: filePath,
        language: result.candidate.file?.language ?? 'unknown',
        relevance: result.relevance,
        mode,
        content: finalContent,
        tokenCount,
        reasons: result.explanations,
      });

      codeTokensUsed += tokenCount;
      remainingTokens -= tokenCount;
    }

    tokenBreakdown.code = codeTokensUsed;

    const totalTokens = tokenBreakdown.rules + tokenBreakdown.repositoryMap + tokenBreakdown.code;
    const totalTime = Date.now() - startTime;

    logger.info(
      `Context built: ${contextFiles.length} files, ${totalTokens}/${this.options.tokenBudget} tokens in ${totalTime}ms`,
    );

    return {
      task: input.task,
      timestamp: new Date().toISOString(),
      repository: input.project,
      rules: input.rules,
      files: contextFiles,
      tokenBudget: this.options.tokenBudget,
      tokenUsage: totalTokens,
      tokenBreakdown,
      retrievalStats: {
        candidateCount: input.rankedResults.length,
        selectedCount: contextFiles.length,
        searchTimeMs: 0,
        rankingTimeMs: 0,
        totalTimeMs: totalTime,
      },
    };
  }

  private extractSignatures(content: string): string {
    const lines = content.split('\n');
    const signatures: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('export ') ||
        trimmed.startsWith('import ') ||
        trimmed.startsWith('class ') ||
        trimmed.startsWith('interface ') ||
        trimmed.startsWith('type ') ||
        trimmed.startsWith('enum ') ||
        trimmed.startsWith('function ') ||
        trimmed.startsWith('const ') ||
        trimmed.startsWith('async function') ||
        trimmed.startsWith('public ') ||
        trimmed.startsWith('private ') ||
        trimmed.startsWith('protected ') ||
        trimmed.startsWith('abstract ')
      ) {
        signatures.push(line);
      }
    }

    return signatures.join('\n');
  }

  private createDigest(content: string, filePath: string): string {
    const lines = content.split('\n');
    const lineCount = lines.length;
    const imports = lines.filter((l) => l.trim().startsWith('import ')).length;
    const exports = lines.filter((l) => l.trim().startsWith('export ')).length;

    return `File: ${filePath}\nLines: ${lineCount}\nImports: ${imports}\nExports: ${exports}`;
  }

  private resolveAbsPath(relativePath: string): string {
    return `${this.options.repositoryRoot}/${relativePath}`.replace(/\\/g, '/');
  }
}

```

## packages/context/src/__tests__/context.test.ts

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ContextEngine } from '../index.js';
import type { RankedResult } from '@codeatlas/ranking';
import type { ProjectMeta } from '@codeatlas/core';

describe('Context Engine & Token Budget Optimization', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-context-test-'));
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });

    fs.writeFileSync(
      path.join(tempDir, 'src', 'small.ts'),
      'export function add(a: number, b: number): number { return a + b; }',
    );

    fs.writeFileSync(
      path.join(tempDir, 'src', 'large.ts'),
      `
      import { something } from 'somewhere';
      export class LargeService {
        methodA() { return 1; }
        methodB() { return 2; }
        methodC() { return 3; }
      }
      ` + '\n// line of code'.repeat(100),
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const project: ProjectMeta = {
    name: 'test-app',
    root: '/test',
    languages: ['typescript'],
    frameworks: [],
    packageManager: 'pnpm',
    fileCount: 2,
    symbolCount: 5,
    dependencyCount: 1,
    isMonorepo: false,
    workspaces: [],
  };

  it('builds context pack within strict token budget', () => {
    const engine = new ContextEngine({
      tokenBudget: 500,
      defaultMode: 'full',
      repositoryRoot: tempDir,
    });

    const rankedResults: RankedResult[] = [
      {
        filePath: 'src/small.ts',
        relevance: 0.9,
        explanations: [{ signal: 'lexical', score: 0.9, weight: 0.25, reason: 'Keyword match' }],
        candidate: {
          filePath: 'src/small.ts',
          sources: [],
          file: {
            path: path.join(tempDir, 'src', 'small.ts'),
            relativePath: 'src/small.ts',
            extension: '.ts',
            language: 'typescript',
            size: 100,
            hash: 'h1',
            module: 'src',
            isTest: false,
            isGenerated: false,
            symbolCount: 1,
            importCount: 0,
            exportCount: 1,
          },
        },
      },
      {
        filePath: 'src/large.ts',
        relevance: 0.7,
        explanations: [{ signal: 'path', score: 0.7, weight: 0.15, reason: 'Path match' }],
        candidate: {
          filePath: 'src/large.ts',
          sources: [],
          file: {
            path: path.join(tempDir, 'src', 'large.ts'),
            relativePath: 'src/large.ts',
            extension: '.ts',
            language: 'typescript',
            size: 2000,
            hash: 'h2',
            module: 'src',
            isTest: false,
            isGenerated: false,
            symbolCount: 4,
            importCount: 1,
            exportCount: 1,
          },
        },
      },
    ];

    const pack = engine.build({
      task: 'Fix addition bug',
      project,
      rankedResults,
      rules: [
        {
          id: 'r1',
          source: 'agents.md',
          scope: 'global',
          filePath: 'AGENTS.md',
          content: 'Follow strict types.',
          priority: 10,
        },
      ],
    });

    expect(pack.tokenUsage).toBeLessThanOrEqual(pack.tokenBudget);
    expect(pack.files.length).toBeGreaterThanOrEqual(1);
    expect(pack.files[0]?.relativePath).toBe('src/small.ts');
    expect(pack.files[0]?.mode).toBe('full');
  });
});

```

## packages/core/src/config.ts

```typescript
import { z } from 'zod';

export const ProjectConfigSchema = z.object({
  name: z.string().default(''),
});

export const IndexConfigSchema = z.object({
  follow_symlinks: z.boolean().default(false),
  include_tests: z.boolean().default(true),
  max_file_size: z.number().default(1_048_576),
});

export const RankingConfigSchema = z.object({
  lexical_weight: z.number().min(0).max(1).default(0.25),
  symbol_weight: z.number().min(0).max(1).default(0.20),
  path_weight: z.number().min(0).max(1).default(0.15),
  dependency_weight: z.number().min(0).max(1).default(0.15),
  rule_weight: z.number().min(0).max(1).default(0.10),
  recency_weight: z.number().min(0).max(1).default(0.10),
  module_weight: z.number().min(0).max(1).default(0.05),
});

export const ContextConfigSchema = z.object({
  max_tokens: z.number().default(12_000),
  default_mode: z.enum(['full', 'signature', 'summary', 'digest']).default('full'),
});

export const SecurityConfigSchema = z.object({
  scan_secrets: z.boolean().default(true),
  exclude_patterns: z.array(z.string()).default(['.env', '*.pem', '*.key']),
});

export const AIConfigSchema = z.object({
  provider: z.string().default('none'),
  model: z.string().optional(),
  api_key: z.string().optional(),
  base_url: z.string().optional(),
});

export const AtlasConfigSchema = z.object({
  project: ProjectConfigSchema.default({}),
  index: IndexConfigSchema.default({}),
  ranking: RankingConfigSchema.default({}),
  context: ContextConfigSchema.default({}),
  security: SecurityConfigSchema.default({}),
  ai: AIConfigSchema.default({}),
});

export type AtlasConfig = z.infer<typeof AtlasConfigSchema>;
export type RankingConfig = z.infer<typeof RankingConfigSchema>;
export type ContextConfig = z.infer<typeof ContextConfigSchema>;

export function parseConfig(raw: unknown): AtlasConfig {
  return AtlasConfigSchema.parse(raw);
}

export function defaultConfig(): AtlasConfig {
  return AtlasConfigSchema.parse({});
}

```

## packages/core/src/__tests__/core.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { defaultConfig, parseConfig, detectLanguage, isTestFile, isGeneratedFile } from '../index.js';

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

```

## packages/exporters/src/exporters.ts

```typescript
import type { ContextPack } from '@codeatlas/core';

export interface ExportOptions {
  target: ExportTarget;
  outputPath?: string;
  merge?: boolean;
}

export type ExportTarget = 'markdown' | 'claude' | 'cursor' | 'copilot' | 'gemini' | 'agents';

export interface Exporter {
  export(pack: ContextPack, options: ExportOptions): string;
  defaultFilename(): string;
}

export class MarkdownExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];

    lines.push(`# Context Pack: ${pack.task}`);
    lines.push('');
    lines.push(`> Generated by CodeAtlas at ${pack.timestamp}`);
    lines.push('');

    // Repository info
    lines.push('## Repository');
    lines.push('');
    lines.push(`- **Name**: ${pack.repository.name}`);
    lines.push(`- **Languages**: ${pack.repository.languages.join(', ')}`);
    lines.push(`- **Frameworks**: ${pack.repository.frameworks.join(', ') || 'none detected'}`);
    lines.push(`- **Files**: ${pack.repository.fileCount}`);
    lines.push('');

    // Token budget
    lines.push('## Token Budget');
    lines.push('');
    lines.push(`| Category | Tokens |`);
    lines.push(`|----------|--------|`);
    lines.push(`| Rules | ${pack.tokenBreakdown.rules.toLocaleString()} |`);
    lines.push(`| Repository map | ${pack.tokenBreakdown.repositoryMap.toLocaleString()} |`);
    lines.push(`| Code | ${pack.tokenBreakdown.code.toLocaleString()} |`);
    lines.push(`| **Total** | **${pack.tokenUsage.toLocaleString()} / ${pack.tokenBudget.toLocaleString()}** |`);
    lines.push('');

    // Rules
    if (pack.rules.length > 0) {
      lines.push('## Rules');
      lines.push('');
      for (const rule of pack.rules) {
        lines.push(`### ${rule.filePath} (${rule.source})`);
        lines.push('');
        lines.push(rule.content);
        lines.push('');
      }
    }

    // Files
    lines.push('## Relevant Files');
    lines.push('');
    for (const file of pack.files) {
      const pct = Math.round(file.relevance * 100);
      lines.push(`### ${file.relativePath} (${pct}% relevance, ${file.mode})`);
      lines.push('');

      if (file.reasons.length > 0) {
        lines.push('**Reasons:**');
        for (const reason of file.reasons) {
          lines.push(`- ${reason.reason} (${reason.signal}: ${(reason.score * 100).toFixed(0)}%)`);
        }
        lines.push('');
      }

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

    // Rules first
    for (const rule of pack.rules) {
      if (rule.source === 'claude.md' || rule.source === 'agents.md') {
        lines.push(rule.content);
        lines.push('');
      }
    }

    // Architecture
    if (pack.architecture) {
      lines.push('## Architecture');
      lines.push('');
      lines.push(pack.architecture);
      lines.push('');
    }

    // Files
    lines.push('## Relevant Source Files');
    lines.push('');
    for (const file of pack.files) {
      lines.push(`### ${file.relativePath}`);
      lines.push('');
      lines.push('```' + file.language);
      lines.push(file.content);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'CLAUDE.atlas.md';
  }
}

export class CursorExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];

    for (const rule of pack.rules) {
      lines.push(rule.content);
      lines.push('');
    }

    lines.push('# Relevant Context');
    lines.push('');
    for (const file of pack.files) {
      lines.push(`## ${file.relativePath}`);
      lines.push('');
      lines.push('```' + file.language);
      lines.push(file.content);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  defaultFilename(): string {
    return '.cursorrules';
  }
}

export class CopilotExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];

    for (const rule of pack.rules) {
      if (rule.source === 'copilot' || rule.source === 'agents.md') {
        lines.push(rule.content);
        lines.push('');
      }
    }

    lines.push('# Project Context');
    lines.push('');
    for (const file of pack.files) {
      lines.push(`## ${file.relativePath}`);
      lines.push('');
      lines.push('```' + file.language);
      lines.push(file.content);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'copilot-instructions.atlas.md';
  }
}

export class GeminiExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];

    for (const rule of pack.rules) {
      if (rule.source === 'gemini.md' || rule.source === 'agents.md') {
        lines.push(rule.content);
        lines.push('');
      }
    }

    lines.push('# Relevant Context');
    lines.push('');
    for (const file of pack.files) {
      lines.push(`## ${file.relativePath}`);
      lines.push('');
      lines.push('```' + file.language);
      lines.push(file.content);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'GEMINI.atlas.md';
  }
}

export class AgentsExporter implements Exporter {
  export(pack: ContextPack, _options: ExportOptions): string {
    const lines: string[] = [];

    for (const rule of pack.rules) {
      lines.push(rule.content);
      lines.push('');
    }

    lines.push('# Relevant Context');
    lines.push('');
    for (const file of pack.files) {
      lines.push(`## ${file.relativePath}`);
      lines.push('');
      lines.push('```' + file.language);
      lines.push(file.content);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  defaultFilename(): string {
    return 'AGENTS.atlas.md';
  }
}

export function createExporter(target: ExportTarget): Exporter {
  switch (target) {
    case 'markdown': return new MarkdownExporter();
    case 'claude': return new ClaudeExporter();
    case 'cursor': return new CursorExporter();
    case 'copilot': return new CopilotExporter();
    case 'gemini': return new GeminiExporter();
    case 'agents': return new AgentsExporter();
  }
}

```

## packages/indexer/src/__tests__/indexer.test.ts

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Scanner, Indexer } from '../index.js';
import { AtlasDatabase, runMigrations, FileRepository, SymbolRepository, DependencyRepository } from '@codeatlas/storage';

describe('Scanner & Indexer Integration', () => {
  let tempDir: string;
  let db: AtlasDatabase;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-index-test-'));
    fs.mkdirSync(path.join(tempDir, 'src', 'auth'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src', 'users'), { recursive: true });

    // Create sample project files
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'demo-app', dependencies: { react: '^18.0.0' } }),
    );

    fs.writeFileSync(
      path.join(tempDir, 'src', 'auth', 'auth.service.ts'),
      `
      import { UserService } from '../users/user.service';

      export interface AuthToken {
        token: string;
      }

      export class AuthService {
        constructor(private userService: UserService) {}

        async login(email: string, password: string): Promise<AuthToken> {
          const user = await this.userService.findByEmail(email);
          return { token: 'jwt-token' };
        }
      }
      `,
    );

    fs.writeFileSync(
      path.join(tempDir, 'src', 'users', 'user.service.ts'),
      `
      export interface User {
        id: string;
        email: string;
      }

      export class UserService {
        async findByEmail(email: string): Promise<User | null> {
          return { id: '1', email };
        }
      }
      `,
    );

    db = new AtlasDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('scans and detects project metadata', async () => {
    const scanner = new Scanner({ root: tempDir });
    const result = await scanner.scan();

    expect(result.detectedFiles).toBeGreaterThanOrEqual(3);
    expect(result.detectedLanguages.has('typescript')).toBe(true);
    expect(result.detectedLanguages.has('json')).toBe(true);
    expect(result.detectedFrameworks).toContain('react');
  });

  it('indexes files, extracts AST symbols, and links dependency graph', async () => {
    const projRes = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'demo-app', tempDir.replace(/\\/g, '/'));
    const projectId = Number(projRes.lastInsertRowid);

    const indexer = new Indexer({
      root: tempDir,
      db,
      projectId,
    });

    const result = await indexer.index();

    expect(result.filesIndexed).toBeGreaterThanOrEqual(3);
    expect(result.symbolsExtracted).toBeGreaterThanOrEqual(4);
    expect(result.dependenciesCreated).toBeGreaterThanOrEqual(1);

    const fileRepo = new FileRepository(db);
    const symbolRepo = new SymbolRepository(db);
    const depRepo = new DependencyRepository(db);

    const files = fileRepo.getAll(projectId);
    expect(files.length).toBeGreaterThanOrEqual(3);

    const authFile = files.find((f) => f.relativePath.includes('auth.service.ts'));
    expect(authFile).toBeDefined();

    const symbols = symbolRepo.getByFile(authFile!.id!);
    const symbolNames = symbols.map((s) => s.name);
    expect(symbolNames).toContain('AuthService');
    expect(symbolNames).toContain('AuthToken');
    expect(symbolNames).toContain('login');

    const deps = depRepo.getAll(projectId);
    expect(deps.length).toBeGreaterThanOrEqual(1);
    expect(deps[0]?.source).toContain('auth.service.ts');
    expect(deps[0]?.target).toContain('user.service.ts');

    // Test incremental indexing - running again without file changes should skip all files
    const result2 = await indexer.index();
    expect(result2.filesSkipped).toBe(result.filesIndexed);
    expect(result2.filesIndexed).toBe(0);
  });
});

```

## packages/parser/src/__tests__/parser.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { parseFile } from '../index.js';

describe('Tree-sitter Parser (TS/JS)', () => {
  it('extracts classes, methods, and functions from TypeScript', async () => {
    const tsCode = `
      import { Injectable } from '@nestjs/common';
      import type { User } from './user.entity';

      export interface AuthResponse {
        token: string;
        expiresIn: number;
      }

      export type AuthToken = string;

      export class AuthService {
        private secret: string;

        async login(email: string, pass: string): Promise<AuthResponse> {
          return { token: 'jwt', expiresIn: 3600 };
        }
      }

      export function validateToken(token: string): boolean {
        return token.length > 0;
      }

      const helper = () => true;
    `;

    const result = await parseFile('src/auth.service.ts', tsCode, 'typescript');

    expect(result.errors).toHaveLength(0);
    expect(result.imports).toHaveLength(2);
    expect(result.imports[0]?.importPath).toBe('@nestjs/common');
    expect(result.imports[1]?.isType).toBe(true);

    const names = result.symbols.map((s) => s.name);
    expect(names).toContain('AuthResponse');
    expect(names).toContain('AuthToken');
    expect(names).toContain('AuthService');
    expect(names).toContain('login');
    expect(names).toContain('validateToken');

    const authService = result.symbols.find((s) => s.name === 'AuthService');
    expect(authService?.kind).toBe('class');
    expect(authService?.exported).toBe(true);

    const loginMethod = result.symbols.find((s) => s.name === 'login');
    expect(loginMethod?.kind).toBe('method');
    expect(loginMethod?.parentSymbol).toBe('AuthService');
  });

  it('handles JavaScript code with ES exports', async () => {
    const jsCode = `
      import express from 'express';

      export class Router {
        handle(req, res) {}
      }

      export const PORT = 3000;
    `;

    const result = await parseFile('src/server.js', jsCode, 'javascript');
    expect(result.errors).toHaveLength(0);
    expect(result.symbols.map((s) => s.name)).toContain('Router');
    expect(result.symbols.map((s) => s.name)).toContain('PORT');
  });
});

```

## packages/storage/src/migrations.ts

```typescript
import type { AtlasDatabase } from './database.js';
import { createLogger } from '@codeatlas/shared';
const logger = createLogger('storage:migrations');
interface Migration {
const MIGRATIONS: Migration[] = [
export function runMigrations(db: AtlasDatabase): void {
  const applied = new Set(
```

## README.md

```markdown

```


## Relevant Codebase Files

### [apps/cli/src/commands/index-cmd.ts](file:///apps/cli/src/commands/index-cmd.ts) (13% match, full)

```typescript
import type { Command } from 'commander';
import chalk from 'chalk';
import { Indexer } from '@codeatlas/indexer';
import { ensureInitialized, openDatabase, getOrCreateProject, loadConfig } from '../utils.js';
import { formatDuration } from '@codeatlas/shared';

export function registerIndexCommand(program: Command): void {
  program
    .command('index')
    .description('Build or update the code index')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed output')
    .action(async (options: { json?: boolean; verbose?: boolean }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const config = loadConfig(cwd);
      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);

      console.log(chalk.bold('Indexing repository...'));
      console.log('');

      const indexer = new Indexer({
        root: cwd,
        db,
        projectId,
        followSymlinks: config.index.follow_symlinks,
        maxFileSize: config.index.max_file_size,
        includeTests: config.index.include_tests,
      });

      const result = await indexer.index();

      db.close();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(chalk.bold('Index Results'));
      console.log('');
      console.log(`  ${chalk.green('✓')} ${chalk.dim('Files indexed')}     ${result.filesIndexed}`);
      console.log(`  ${chalk.dim('○')} ${chalk.dim('Files unchanged')}   ${result.filesSkipped}`);
      console.log(`  ${chalk.blue('↻')} ${chalk.dim('Files updated')}    ${result.filesUpdated}`);
      if (result.filesDeleted > 0) {
        console.log(`  ${chalk.red('✗')} ${chalk.dim('Files deleted')}    ${result.filesDeleted}`);
      }
      console.log(
        `  ${chalk.cyan('◆')} ${chalk.dim('Symbols')}          ${result.symbolsExtracted}`,
      );
      console.log(
        `  ${chalk.cyan('→')} ${chalk.dim('Imports')}          ${result.importsExtracted}`,
      );
      console.log(
        `  ${chalk.cyan('⬡')} ${chalk.dim('Dependencies')}     ${result.dependenciesCreated}`,
      );
      console.log(
        `  ${chalk.dim('⏱')} ${chalk.dim('Duration')}         ${formatDuration(result.duration)}`,
      );

      if (result.errors.length > 0 && options.verbose) {
        console.log('');
        console.log(chalk.yellow(`  ${result.errors.length} errors during indexing:`));
        for (const error of result.errors.slice(0, 10)) {
          console.log(chalk.dim(`    • ${error}`));
        }
        if (result.errors.length > 10) {
          console.log(chalk.dim(`    ... and ${result.errors.length - 10} more`));
        }
      }

      console.log('');
    });
}

```

### [apps/cli/src/commands/map.ts](file:///apps/cli/src/commands/map.ts) (13% match, full)

```typescript
import type { Command } from 'commander';
import chalk from 'chalk';
import { ensureInitialized, openDatabase, getOrCreateProject } from '../utils.js';
import { FileRepository, SymbolRepository } from '@codeatlas/storage';

export function registerMapCommand(program: Command): void {
  program
    .command('map')
    .description('Display the repository map with symbols')
    .option('--depth <n>', 'Max directory depth', '3')
    .option('--symbols', 'Include symbols in the map', true)
    .option('--json', 'Output as JSON')
    .action(async (options: { depth: string; symbols: boolean; json?: boolean }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);
      const fileRepo = new FileRepository(db);
      const symbolRepo = new SymbolRepository(db);

      const files = fileRepo.getAll(projectId);

      if (files.length === 0) {
        console.log(chalk.yellow('No files indexed. Run: atlas index'));
        db.close();
        return;
      }

      if (options.json) {
        const data = files.map((f) => ({
          ...f,
          symbols: options.symbols ? symbolRepo.getByFile(f.id!) : [],
        }));
        console.log(JSON.stringify(data, null, 2));
        db.close();
        return;
      }

      console.log('');
      console.log(chalk.bold('Repository Map'));
      console.log('');

      // Build tree
      const tree = new Map<string, typeof files>();
      for (const file of files) {
        const module = file.module || '.';
        if (!tree.has(module)) tree.set(module, []);
        tree.get(module)!.push(file);
      }

      const maxDepth = parseInt(options.depth, 10);
      const sortedModules = [...tree.keys()].sort();

      for (const module of sortedModules) {
        const depth = module === '.' ? 0 : module.split('/').length;
        if (depth > maxDepth) continue;

        const indent = '  '.repeat(depth);
        const moduleFiles = tree.get(module)!;

        console.log(`${indent}${chalk.blue(module === '.' ? '.' : module + '/')}`);

        for (const file of moduleFiles.sort((a, b) =>
          a.relativePath.localeCompare(b.relativePath),
        )) {
          const basename = file.relativePath.split('/').pop() ?? file.relativePath;
          const langIcon = getLangIcon(file.language);
          console.log(
            `${indent}  ${langIcon} ${chalk.white(basename)} ${chalk.dim(`(${file.symbolCount} symbols)`)}`,
          );

          if (options.symbols && file.id) {
            const symbols = symbolRepo.getByFile(file.id);
            const exported = symbols.filter((s) => s.exported);
            for (const sym of exported.slice(0, 8)) {
              const kindIcon = getKindIcon(sym.kind);
              console.log(`${indent}    ${kindIcon} ${chalk.dim(sym.name)}`);
            }
            if (exported.length > 8) {
              console.log(`${indent}    ${chalk.dim(`... +${exported.length - 8} more`)}`);
            }
          }
        }
      }

      db.close();
      console.log('');
    });
}

function getLangIcon(lang: string): string {
  const icons: Record<string, string> = {
    typescript: chalk.blue('TS'),
    javascript: chalk.yellow('JS'),
    python: chalk.green('PY'),
    go: chalk.cyan('GO'),
    rust: chalk.red('RS'),
    json: chalk.gray('{}'),
    yaml: chalk.gray('YA'),
    markdown: chalk.gray('MD'),
  };
  return icons[lang] ?? chalk.gray('  ');
}

function getKindIcon(kind: string): string {
  const icons: Record<string, string> = {
    class: chalk.yellow('◆'),
    function: chalk.blue('ƒ'),
    method: chalk.blue('→'),
    interface: chalk.green('◇'),
    type: chalk.magenta('T'),
    enum: chalk.cyan('E'),
    variable: chalk.gray('v'),
    constant: chalk.gray('C'),
  };
  return icons[kind] ?? chalk.gray('·');
}

```

### [apps/cli/src/commands/rules.ts](file:///apps/cli/src/commands/rules.ts) (13% match, full)

```typescript
import type { Command } from 'commander';
import chalk from 'chalk';
import { ensureInitialized } from '../utils.js';
import { RuleEngine } from '@codeatlas/rules';

export function registerRulesCommand(program: Command): void {
  const rules = program.command('rules').description('Manage AI rules and instructions');

  rules
    .command('list')
    .description('List discovered rules')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const engine = new RuleEngine(cwd);
      const discovered = engine.discover();

      if (options.json) {
        console.log(JSON.stringify(discovered, null, 2));
        return;
      }

      if (discovered.length === 0) {
        console.log(chalk.yellow('No rules discovered.'));
        console.log(
          chalk.dim(
            'Supported files: AGENTS.md, CLAUDE.md, GEMINI.md, .cursorrules, .github/copilot-instructions.md',
          ),
        );
        return;
      }

      console.log('');
      console.log(chalk.bold(`Rules (${discovered.length})`));
      console.log('');

      for (const rule of discovered) {
        const scopeLabel =
          rule.scope === 'global'
            ? chalk.green('GLOBAL')
            : chalk.blue(`PATH: ${rule.pathPattern ?? ''}`);
        console.log(`  ${chalk.white(rule.filePath)}`);
        console.log(
          `    ${chalk.dim('Source:')} ${rule.source}  ${chalk.dim('Scope:')} ${scopeLabel}  ${chalk.dim('Priority:')} ${rule.priority}`,
        );
        const preview = rule.content.trim().split('\n')[0]?.slice(0, 80) ?? '';
        console.log(`    ${chalk.dim(preview)}`);
        console.log('');
      }
    });

  rules
    .command('validate')
    .description('Validate rules and detect conflicts')
    .action(async () => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const engine = new RuleEngine(cwd);
      engine.discover();

      const conflicts = engine.detectConflicts();
      const issues = engine.validate();

      console.log('');
      console.log(chalk.bold('Rule Validation'));
      console.log('');

      if (conflicts.length === 0 && issues.length === 0) {
        console.log(chalk.green('  ✓ No conflicts or issues found.'));
      }

      if (conflicts.length > 0) {
        console.log(chalk.yellow(`  Conflicts (${conflicts.length}):`));
        for (const conflict of conflicts) {
          console.log(`    ${chalk.red('✗')} ${conflict.reason}`);
          console.log(
            `      ${chalk.dim(conflict.ruleA.filePath)} ↔ ${chalk.dim(conflict.ruleB.filePath)}`,
          );
          if (conflict.suggestion) {
            console.log(`      ${chalk.dim('Suggestion: ' + conflict.suggestion)}`);
          }
        }
      }

      if (issues.length > 0) {
        console.log('');
        console.log(chalk.yellow(`  Issues (${issues.length}):`));
        for (const issue of issues) {
          const icon =
            issue.severity === 'error'
              ? chalk.red('✗')
              : issue.severity === 'warning'
                ? chalk.yellow('!')
                : chalk.blue('i');
          console.log(`    ${icon} ${issue.issue}`);
          console.log(`      ${chalk.dim(issue.rule.filePath)}`);
        }
      }

      console.log('');
    });

  // Default action when 'atlas rules' is called without subcommand
  rules.action(async () => {
    rules.commands.find((c) => c.name() === 'list')?.parse(process.argv);
  });
}

```

### [apps/cli/src/commands/scan.ts](file:///apps/cli/src/commands/scan.ts) (13% match, full)

```typescript
import type { Command } from 'commander';
import chalk from 'chalk';
import { Scanner } from '@codeatlas/indexer';
import { ensureInitialized, openDatabase, getOrCreateProject, loadConfig } from '../utils.js';

export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Scan and detect repository structure')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const config = loadConfig(cwd);
      const scanner = new Scanner({
        root: cwd,
        followSymlinks: config.index.follow_symlinks,
        maxFileSize: config.index.max_file_size,
        includeTests: config.index.include_tests,
      });

      const result = await scanner.scan();

      // Update project in database
      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);

      db.run(
        `UPDATE projects SET
         package_manager = ?,
         is_monorepo = ?,
         languages = ?,
         frameworks = ?,
         workspaces = ?,
         updated_at = datetime('now')
         WHERE id = ?`,
        result.detectedPackageManager,
        result.isMonorepo ? 1 : 0,
        JSON.stringify(result.project.languages),
        JSON.stringify(result.project.frameworks),
        JSON.stringify(result.workspaces),
        projectId,
      );

      db.close();

      if (options.json) {
        console.log(
          JSON.stringify(result, (_k, v) => (v instanceof Map ? Object.fromEntries(v) : v), 2),
        );
        return;
      }

      console.log('');
      console.log(chalk.bold('Repository Scan'));
      console.log('');
      console.log(`  ${chalk.dim('Project')}      ${result.project.name}`);
      console.log(`  ${chalk.dim('Files')}        ${result.detectedFiles.toLocaleString()}`);
      console.log(`  ${chalk.dim('Skipped')}      ${result.skippedFiles.toLocaleString()}`);
      console.log(`  ${chalk.dim('Package Mgr')}  ${result.detectedPackageManager}`);
      console.log(`  ${chalk.dim('Monorepo')}     ${result.isMonorepo ? 'yes' : 'no'}`);
      console.log(`  ${chalk.dim('Tests')}        ${result.hasTests ? 'yes' : 'no'}`);
      console.log(`  ${chalk.dim('Docs')}         ${result.hasDocs ? 'yes' : 'no'}`);
      console.log(`  ${chalk.dim('CI')}           ${result.hasCI ? 'yes' : 'no'}`);
      console.log(`  ${chalk.dim('Duration')}     ${result.duration}ms`);
      console.log('');

      console.log(chalk.bold('  Languages'));
      const sorted = [...result.detectedLanguages.entries()].sort((a, b) => b[1] - a[1]);
      for (const [lang, count] of sorted) {
        const bar = '█'.repeat(
          Math.min(Math.ceil((count / Math.max(...sorted.map((s) => s[1]))) * 20), 20),
        );
        console.log(`    ${chalk.dim(lang.padEnd(14))} ${chalk.cyan(bar)} ${count}`);
      }

      if (result.detectedFrameworks.length > 0) {
        console.log('');
        console.log(chalk.bold('  Frameworks'));
        for (const fw of result.detectedFrameworks) {
          console.log(`    ${chalk.green('●')} ${fw}`);
        }
      }

      console.log('');
    });
}

```

### [CONTRIBUTING.md](file:///CONTRIBUTING.md) (13% match, full)

```markdown
# Contributing to CodeAtlas

Thank you for your interest in contributing to CodeAtlas!

## Development Setup

1. **Prerequisites**: Node.js ≥20, pnpm ≥9
2. Clone the repository
3. Run `pnpm install`
4. Run `pnpm build` to verify the build works

## Project Structure

This is a pnpm monorepo with packages in `packages/` and apps in `apps/`.

## Making Changes

1. Create a feature branch from `main`
2. Make your changes
3. Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`
4. Submit a pull request

## Code Style

- TypeScript strict mode
- Prettier for formatting
- ESLint for linting
- Explicit types at boundaries
- Avoid `any` — use `unknown` when the type is truly unknown

## Testing

We use Vitest. Run tests with `pnpm test`.

Tests should validate meaningful behavior, not just check that functions exist.

## Commit Messages

Use conventional commit format:

```
feat(parser): add Python language support
fix(indexer): handle symlinks on Windows
docs: update CLI reference
```

## Questions?

Open an issue for discussion.

```

### [LICENSE](file:///LICENSE) (13% match, full)

```unknown
MIT License

Copyright (c) 2024 CodeAtlas Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

### [packages/core/src/languages.ts](file:///packages/core/src/languages.ts) (13% match, full)

```typescript
import type { Language } from './models.js';

const EXTENSION_TO_LANGUAGE: Record<string, Language> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.md': 'markdown',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sql': 'sql',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
};

const FILENAME_TO_LANGUAGE: Record<string, Language> = {
  Dockerfile: 'dockerfile',
  Makefile: 'shell',
};

export function detectLanguage(filePath: string): Language {
  const basename = filePath.split('/').pop() ?? '';

  const filenameMatch = FILENAME_TO_LANGUAGE[basename];
  if (filenameMatch) {
    return filenameMatch;
  }

  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex === -1) {
    return 'unknown';
  }

  const ext = basename.slice(dotIndex).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] ?? 'unknown';
}

export function isParseableLanguage(language: Language): boolean {
  return (
    language === 'typescript' ||
    language === 'javascript' ||
    language === 'python' ||
    language === 'go' ||
    language === 'rust'
  );
}

export function isTestFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.startsWith('test/') ||
    normalized.startsWith('tests/') ||
    normalized.startsWith('__tests__/') ||
    normalized.includes('__tests__/') ||
    normalized.includes('__test__/') ||
    normalized.includes('/test/') ||
    normalized.includes('/tests/') ||
    normalized.includes('.test.') ||
    normalized.includes('.spec.') ||
    normalized.includes('_test.') ||
    normalized.includes('_spec.')
  );
}

export function isGeneratedFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return (
    normalized.startsWith('dist/') ||
    normalized.startsWith('build/') ||
    normalized.startsWith('out/') ||
    normalized.includes('/dist/') ||
    normalized.includes('/build/') ||
    normalized.includes('/out/') ||
    normalized.includes('.min.') ||
    normalized.includes('.generated.') ||
    normalized.includes('.d.ts') ||
    normalized.includes('/coverage/') ||
    normalized.startsWith('coverage/') ||
    normalized.includes('/__generated__/')
  );
}

const PARSEABLE_LANGUAGES: Set<Language> = new Set([
  'typescript',
  'javascript',
  'python',
  'go',
  'rust',
]);

export function canParse(language: Language): boolean {
  return PARSEABLE_LANGUAGES.has(language);
}

```

### [packages/core/src/models.ts](file:///packages/core/src/models.ts) (13% match, full)

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
  'agents.md' | 'claude.md' | 'gemini.md' | 'cursor' | 'copilot' | 'atlas' | 'custom';

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

### [packages/core/src/__tests__/core.test.ts](file:///packages/core/src/__tests__/core.test.ts) (13% match, full)

```typescript
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

```

### [packages/exporters/src/__tests__/exporters.test.ts](file:///packages/exporters/src/__tests__/exporters.test.ts) (13% match, full)

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

  it('exports to Markdown format', () => {
    const exporter = createExporter('markdown');
    const output = exporter.export(samplePack, { target: 'markdown' });

    expect(output).toContain('# Context Pack: Add Google OAuth login');
    expect(output).toContain('## Repository');
    expect(output).toContain('## Relevant Files');
    expect(output).toContain('src/auth/auth.service.ts');
  });

  it('exports to Claude format', () => {
    const exporter = createExporter('claude');
    const output = exporter.export(samplePack, { target: 'claude' });

    expect(output).toContain('# Project Context');
    expect(output).toContain('Use strict TypeScript');
    expect(output).toContain('src/auth/auth.service.ts');
    expect(exporter.defaultFilename()).toBe('CLAUDE.atlas.md');
  });

  it('exports to Cursor format', () => {
    const exporter = createExporter('cursor');
    const output = exporter.export(samplePack, { target: 'cursor' });

    expect(output).toContain('# Relevant Context');
    expect(output).toContain('src/auth/auth.service.ts');
    expect(exporter.defaultFilename()).toBe('.cursorrules');
  });

  it('exports to Antigravity format', () => {
    const exporter = createExporter('antigravity');
    const output = exporter.export(samplePack, { target: 'antigravity' });

    expect(output).toContain('# Antigravity Context Injection');
    expect(output).toContain('## Relevant Codebase Files');
    expect(output).toContain('src/auth/auth.service.ts');
    expect(exporter.defaultFilename()).toBe('ANTIGRAVITY.atlas.md');
  });

  it('exports to Codex format', () => {
    const exporter = createExporter('codex');
    const output = exporter.export(samplePack, { target: 'codex' });

    expect(output).toContain('// Task: Add Google OAuth login');
    expect(output).toContain('// File: src/auth/auth.service.ts');
    expect(exporter.defaultFilename()).toBe('CODEX.atlas.md');
  });

  it('exports to Aider, Windsurf, and Cline formats', () => {
    const aider = createExporter('aider');
    expect(aider.export(samplePack, { target: 'aider' })).toContain('# Aider Context Instructions');
    expect(aider.defaultFilename()).toBe('.aider.atlas.md');

    const windsurf = createExporter('windsurf');
    expect(windsurf.export(samplePack, { target: 'windsurf' })).toContain('# Windsurf Rules & Context');
    expect(windsurf.defaultFilename()).toBe('.windsurfrules');

    const cline = createExporter('cline');
    expect(cline.export(samplePack, { target: 'cline' })).toContain('# Cline Custom Instructions');
    expect(cline.defaultFilename()).toBe('.clinerules');
  });
});

```

### [packages/graph/src/__tests__/graph.test.ts](file:///packages/graph/src/__tests__/graph.test.ts) (13% match, full)

```typescript
import { describe, it, expect } from 'vitest';
import { DependencyGraph } from '../index.js';

describe('Dependency Graph', () => {
  it('constructs graph and traverses forward/backward dependencies', () => {
    const graph = new DependencyGraph();

    graph.addEdge({
      source: 'src/auth/auth.controller.ts',
      target: 'src/auth/auth.service.ts',
      kind: 'import',
      symbols: ['AuthService'],
      weight: 1.0,
    });

    graph.addEdge({
      source: 'src/auth/auth.service.ts',
      target: 'src/users/user.service.ts',
      kind: 'import',
      symbols: ['UserService'],
      weight: 1.0,
    });

    graph.addEdge({
      source: 'src/users/user.service.ts',
      target: 'src/database/db.ts',
      kind: 'import',
      symbols: ['db'],
      weight: 1.0,
    });

    expect(graph.getEdgeCount()).toBe(3);
    expect(graph.getAllNodes().size).toBe(4);

    // Direct dependencies (depth 1)
    const directDeps = graph.getDependencies('src/auth/auth.controller.ts', 1);
    expect(directDeps.has('src/auth/auth.service.ts')).toBe(true);
    expect(directDeps.has('src/users/user.service.ts')).toBe(false);

    // Transitive dependencies (depth 2)
    const transitive = graph.getDependencies('src/auth/auth.controller.ts', 2);
    expect(transitive.has('src/users/user.service.ts')).toBe(true);

    // Reverse dependencies (dependents)
    const dependents = graph.getDependents('src/database/db.ts', 2);
    expect(dependents.has('src/users/user.service.ts')).toBe(true);
    expect(dependents.has('src/auth/auth.service.ts')).toBe(true);

    // Shortest path
    const path = graph.getShortestPath('src/auth/auth.controller.ts', 'src/database/db.ts');
    expect(path).toEqual([
      'src/auth/auth.controller.ts',
      'src/auth/auth.service.ts',
      'src/users/user.service.ts',
      'src/database/db.ts',
    ]);
  });
});

```

### [packages/indexer/src/indexer.ts](file:///packages/indexer/src/indexer.ts) (13% match, full)

```typescript
import fs from 'node:fs';
import { createLogger, hashContent } from '@codeatlas/shared';
import { canParse } from '@codeatlas/core';
import { parseFile } from '@codeatlas/parser';
import type { AtlasDatabase } from '@codeatlas/storage';
import {
  FileRepository,
  SymbolRepository,
  ImportRepository,
  DependencyRepository,
  SearchRepository,
} from '@codeatlas/storage';
import type { DependencyEdge } from '@codeatlas/core';
import { Scanner, type ScanOptions } from './scanner.js';

const logger = createLogger('indexer');

export interface IndexOptions extends ScanOptions {
  db: AtlasDatabase;
  projectId: number;
}

export interface IndexResult {
  filesIndexed: number;
  filesSkipped: number;
  filesUpdated: number;
  filesDeleted: number;
  symbolsExtracted: number;
  importsExtracted: number;
  dependenciesCreated: number;
  errors: string[];
  duration: number;
}

export class Indexer {
  private fileRepo: FileRepository;
  private symbolRepo: SymbolRepository;
  private importRepo: ImportRepository;
  private depRepo: DependencyRepository;
  private searchRepo: SearchRepository;
  private scanner: Scanner;

  constructor(private options: IndexOptions) {
    this.fileRepo = new FileRepository(options.db);
    this.symbolRepo = new SymbolRepository(options.db);
    this.importRepo = new ImportRepository(options.db);
    this.depRepo = new DependencyRepository(options.db);
    this.searchRepo = new SearchRepository(options.db);
    this.scanner = new Scanner(options);
  }

  async index(): Promise<IndexResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let filesIndexed = 0;
    let filesSkipped = 0;
    let filesUpdated = 0;
    let filesDeleted = 0;
    let symbolsExtracted = 0;
    let importsExtracted = 0;
    let dependenciesCreated = 0;

    logger.info('Starting indexing...');

    const files = await this.scanner.collectFiles();
    const existingHashes = this.fileRepo.getAllHashes(this.options.projectId);
    const existingPaths = new Set(existingHashes.keys());
    const currentPaths = new Set(files.map((f) => f.relativePath));

    // Delete removed files
    for (const existingPath of existingPaths) {
      if (!currentPaths.has(existingPath)) {
        this.fileRepo.delete(this.options.projectId, existingPath);
        filesDeleted++;
      }
    }

    // Index new and changed files
    const dependencies: DependencyEdge[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file.path, 'utf-8');
        const contentHash = hashContent(content);

        const existingHash = existingHashes.get(file.relativePath);
        if (existingHash === contentHash) {
          filesSkipped++;
          continue;
        }

        file.hash = contentHash;

        // Parse if the language supports it
        if (canParse(file.language)) {
          const parseResult = await parseFile(
            file.relativePath,
            content,
            file.language as 'typescript' | 'javascript',
          );

          file.symbolCount = parseResult.symbols.length;
          file.importCount = parseResult.imports.length;
          file.exportCount = parseResult.exportedNames.length;

          // Upsert file
          const fileId = this.fileRepo.upsert(this.options.projectId, file);

          // Clear old symbols and imports
          this.symbolRepo.deleteByFile(fileId);
          this.importRepo.deleteByFile(fileId);

          // Insert symbols
          if (parseResult.symbols.length > 0) {
            this.symbolRepo.insertBatch(fileId, parseResult.symbols);
            symbolsExtracted += parseResult.symbols.length;
          }

          // Insert imports
          if (parseResult.imports.length > 0) {
            this.importRepo.insertBatch(fileId, parseResult.imports);
            importsExtracted += parseResult.imports.length;

            // Create dependency edges
            for (const imp of parseResult.imports) {
              const resolvedTarget = this.resolveImportPath(
                file.relativePath,
                imp.importPath,
                currentPaths,
              );
              if (resolvedTarget) {
                dependencies.push({
                  source: file.relativePath,
                  target: resolvedTarget,
                  kind: 'import',
                  symbols: imp.symbols,
                  weight: 1.0,
                });
              }
            }
          }

          // Update FTS index
          try {
            this.searchRepo.removeFile(fileId);
          } catch {
            /* FTS entry may not exist */
          }
          this.searchRepo.indexFile(fileId, file.relativePath, content);

          if (parseResult.errors.length > 0) {
            errors.push(...parseResult.errors);
          }

          filesUpdated++;
        } else {
          // Non-parseable file: just index metadata
          const fileId = this.fileRepo.upsert(this.options.projectId, file);

          try {
            this.searchRepo.removeFile(fileId);
          } catch {
            /* FTS entry may not exist */
          }
          this.searchRepo.indexFile(fileId, file.relativePath, content);

          filesUpdated++;
        }

        filesIndexed++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to index ${file.relativePath}: ${msg}`);
        logger.debug(`Index error for ${file.relativePath}: ${msg}`);
      }
    }

    // Insert dependencies
    if (dependencies.length > 0) {
      this.depRepo.deleteAll(this.options.projectId);
      this.depRepo.insertBatch(this.options.projectId, dependencies);
      dependenciesCreated = dependencies.length;
    }

    // Update index state
    this.options.db.run(
      `INSERT INTO index_state (project_id, file_count, symbol_count, import_count, version, hash)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id)
       DO UPDATE SET last_indexed=datetime('now'), file_count=excluded.file_count, symbol_count=excluded.symbol_count, import_count=excluded.import_count, hash=excluded.hash`,
      this.options.projectId,
      filesIndexed,
      symbolsExtracted,
      importsExtracted,
      '0.1.0',
      hashContent(String(Date.now())),
    );

    const duration = Date.now() - startTime;
    logger.info(
      `Indexing complete: ${filesIndexed} indexed, ${filesSkipped} unchanged, ${filesDeleted} deleted, ${symbolsExtracted} symbols, ${dependenciesCreated} deps in ${duration}ms`,
    );

    return {
      filesIndexed,
      filesSkipped,
      filesUpdated,
      filesDeleted,
      symbolsExtracted,
      importsExtracted,
      dependenciesCreated,
      errors,
      duration,
    };
  }

  private resolveImportPath(
    fromPath: string,
    importPath: string,
    existingPaths: Set<string>,
  ): string | undefined {
    // Skip external packages
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return undefined;
    }

    const fromDir = fromPath.split('/').slice(0, -1).join('/');
    let resolved: string;

    if (importPath.startsWith('.')) {
      const parts = fromDir ? fromDir.split('/') : [];
      const importParts = importPath.split('/');

      for (const part of importParts) {
        if (part === '.') continue;
        if (part === '..') {
          parts.pop();
        } else {
          parts.push(part);
        }
      }
      resolved = parts.join('/');
    } else {
      resolved = importPath;
    }

    // Try extensions
    const extensions = [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '/index.ts',
      '/index.tsx',
      '/index.js',
      '/index.jsx',
    ];

    if (existingPaths.has(resolved)) {
      return resolved;
    }

    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (existingPaths.has(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }
}

```

### [packages/indexer/src/__tests__/indexer.test.ts](file:///packages/indexer/src/__tests__/indexer.test.ts) (13% match, signature)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Scanner, Indexer } from '../index.js';
import {
      import { UserService } from '../users/user.service';
      export interface AuthToken {
      export class AuthService {
          const user = await this.userService.findByEmail(email);
      export interface User {
      export class UserService {
    const scanner = new Scanner({ root: tempDir });
    const result = await scanner.scan();
    const projRes = db.run(
    const projectId = Number(projRes.lastInsertRowid);
    const indexer = new Indexer({
    const result = await indexer.index();
    const fileRepo = new FileRepository(db);
    const symbolRepo = new SymbolRepository(db);
    const depRepo = new DependencyRepository(db);
    const files = fileRepo.getAll(projectId);
    const authFile = files.find((f) => f.relativePath.includes('auth.service.ts'));
    const symbols = symbolRepo.getByFile(authFile!.id!);
    const symbolNames = symbols.map((s) => s.name);
    const deps = depRepo.getAll(projectId);
    const result2 = await indexer.index();
```

### [packages/parser/src/__tests__/parser.test.ts](file:///packages/parser/src/__tests__/parser.test.ts) (13% match, digest)

```typescript
File: packages/parser/src/__tests__/parser.test.ts
Lines: 202
Imports: 7
Exports: 6
```

### [packages/retrieval/src/retrieval-engine.ts](file:///packages/retrieval/src/retrieval-engine.ts) (13% match, digest)

```typescript
File: packages/retrieval/src/retrieval-engine.ts
Lines: 164
Imports: 4
Exports: 3
```

### [packages/retrieval/src/__tests__/retrieval.test.ts](file:///packages/retrieval/src/__tests__/retrieval.test.ts) (13% match, digest)

```typescript
File: packages/retrieval/src/__tests__/retrieval.test.ts
Lines: 87
Imports: 5
Exports: 0
```

### [packages/rules/src/rule-engine.ts](file:///packages/rules/src/rule-engine.ts) (13% match, digest)

```typescript
File: packages/rules/src/rule-engine.ts
Lines: 256
Imports: 4
Exports: 1
```

### [packages/rules/src/__tests__/rules.test.ts](file:///packages/rules/src/__tests__/rules.test.ts) (13% match, signature)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { RuleEngine } from '../index.js';
    const cursorDir = path.join(tempDir, '.cursor', 'rules');
    const engine = new RuleEngine(tempDir);
    const rules = engine.discover();
    const sources = rules.map((r) => r.source);
    const engine = new RuleEngine(tempDir);
    const conflicts = engine.detectConflicts();
```

### [packages/shared/src/__tests__/shared.test.ts](file:///packages/shared/src/__tests__/shared.test.ts) (13% match, signature)

```typescript
import { describe, it, expect } from 'vitest';
import {
    const h1 = hashContent('hello');
    const h2 = hashContent('hello');
    const h3 = hashContent('world');
    const items = [
    const grouped = groupBy(items, (i) => i.type);
    const success = ok(42);
    const failure = err(new Error('fail'));
```

### [packages/storage/src/repositories.ts](file:///packages/storage/src/repositories.ts) (13% match, digest)

```typescript
File: packages/storage/src/repositories.ts
Lines: 328
Imports: 2
Exports: 4
```

### [README.md](file:///README.md) (13% match, signature)

```markdown

```

### [SECURITY.md](file:///SECURITY.md) (13% match, signature)

```markdown

```

# Project Context

## Relevant Source Files

### packages/token-counter/package.json

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

### packages/token-counter/src/index.ts

```typescript
export { TokenCounter, createTokenCounter } from './token-counter.js';
```

### packages/token-counter/src/token-counter.ts

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

### packages/token-counter/src/**tests**/token-counter.test.ts

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

### packages/token-counter/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### packages/token-counter/tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

### apps/cli/package.json

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

### apps/cli/src/commands/context.ts

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
    .action(
      async (
        task: string,
        options: { budget: string; limit: string; json?: boolean; verbose?: boolean },
      ) => {
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
          languages: JSON.parse(
            (project?.['languages'] as string) ?? '[]',
          ) as ProjectMeta['languages'],
          frameworks: JSON.parse(
            (project?.['frameworks'] as string) ?? '[]',
          ) as ProjectMeta['frameworks'],
          packageManager:
            (project?.['package_manager'] as ProjectMeta['packageManager']) ?? 'unknown',
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
          console.log(
            `  ${chalk.green(String(pct).padStart(3) + '%')}  ${chalk.cyan(bar.padEnd(20))} ${file.relativePath}${modeLabel} ${chalk.dim(`(${file.tokenCount} tokens)`)}`,
          );

          if (options.verbose) {
            for (const reason of file.reasons) {
              console.log(`       ${chalk.dim('→ ' + reason.reason)}`);
            }
          }
        }

        console.log('');
        console.log(chalk.bold('  Token Budget'));
        console.log('');
        console.log(
          `  ${chalk.dim('Rules'.padEnd(20))} ${contextPack.tokenBreakdown.rules.toLocaleString().padStart(8)}`,
        );
        console.log(
          `  ${chalk.dim('Repository map'.padEnd(20))} ${contextPack.tokenBreakdown.repositoryMap.toLocaleString().padStart(8)}`,
        );
        console.log(
          `  ${chalk.dim('Code'.padEnd(20))} ${contextPack.tokenBreakdown.code.toLocaleString().padStart(8)}`,
        );
        console.log(`  ${'─'.repeat(30)}`);
        console.log(
          `  ${chalk.bold('Total'.padEnd(20))} ${chalk.bold(contextPack.tokenUsage.toLocaleString().padStart(8))} / ${contextPack.tokenBudget.toLocaleString()}`,
        );

        if (contextPack.rules.length > 0) {
          console.log('');
          console.log(chalk.bold(`  Rules (${contextPack.rules.length})`));
          for (const rule of contextPack.rules) {
            console.log(`    ${chalk.dim('●')} ${rule.filePath} ${chalk.dim(`[${rule.source}]`)}`);
          }
        }

        console.log('');
        console.log(
          chalk.dim(
            `  ${contextPack.retrievalStats.candidateCount} candidates → ${contextPack.retrievalStats.selectedCount} selected in ${contextPack.retrievalStats.totalTimeMs}ms`,
          ),
        );
        console.log('');
      },
    );
}
```

### apps/cli/src/commands/export.ts

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
    .requiredOption(
      '--target <target>',
      'Export target: markdown, claude, cursor, copilot, gemini, agents',
    )
    .option('--task <task>', 'Task for context generation', 'General project context')
    .option('--budget <tokens>', 'Token budget')
    .option('--output <path>', 'Output file path')
    .action(async (options: { target: string; task: string; budget?: string; output?: string }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const target = options.target as ExportTarget;
      const validTargets: ExportTarget[] = [
        'markdown',
        'claude',
        'cursor',
        'copilot',
        'gemini',
        'agents',
      ];
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

      const ranker = new Ranker({
        weights: config.ranking,
        queryTerms: retrievalResult.queryTerms,
      });
      const ranked = ranker.rank(retrievalResult.candidates);

      const ruleEngine = new RuleEngine(cwd);
      const rules = ruleEngine.discover();

      const project = db.get<Record<string, unknown>>(
        'SELECT * FROM projects WHERE id = ?',
        projectId,
      );
      const projectMeta: ProjectMeta = {
        name: (project?.['name'] as string) ?? '',
        root: cwd.replace(/\\/g, '/'),
        languages: JSON.parse(
          (project?.['languages'] as string) ?? '[]',
        ) as ProjectMeta['languages'],
        frameworks: JSON.parse(
          (project?.['frameworks'] as string) ?? '[]',
        ) as ProjectMeta['frameworks'],
        packageManager:
          (project?.['package_manager'] as ProjectMeta['packageManager']) ?? 'unknown',
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

      const contextPack = contextEngine.build({
        task: options.task,
        project: projectMeta,
        rankedResults: ranked,
        rules,
      });

      db.close();

      const exporter = createExporter(target);
      const content = exporter.export(contextPack, { target });
      const outputPath = options.output ?? path.join(cwd, exporter.defaultFilename());

      // Check for existing file
      if (fs.existsSync(outputPath) && !options.output) {
        const basename = path.basename(outputPath);
        console.log(chalk.yellow(`  Existing ${basename} detected.`));
        console.log(chalk.dim(`  Writing to ${basename.replace('.md', '.atlas.md')} instead.`));
        const altPath = outputPath
          .replace('.md', '.atlas.md')
          .replace('.cursorrules', '.cursorrules.atlas');
        fs.writeFileSync(altPath, content, 'utf-8');
        console.log(chalk.green(`  ✓ Exported to ${path.relative(cwd, altPath)}`));
      } else {
        fs.writeFileSync(outputPath, content, 'utf-8');
        console.log(chalk.green(`  ✓ Exported to ${path.relative(cwd, outputPath)}`));
      }

      console.log(
        chalk.dim(
          `  ${contextPack.files.length} files, ${contextPack.tokenUsage.toLocaleString()} tokens`,
        ),
      );
      console.log('');
    });
}
```

### apps/cli/src/utils.ts

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
  const existing = db.get<{ id: number }>('SELECT id FROM projects WHERE root = ?', normalizedRoot);

  if (existing) {
    return existing.id;
  }

  const name = path.basename(cwd);
  const result = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', name, normalizedRoot);
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
        try {
          value = JSON.parse(strValue.replace(/'/g, '"'));
        } catch {
          /* keep string */
        }
      } else if (!isNaN(Number(strValue))) value = Number(strValue);

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

### packages/context/package.json

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

### packages/context/src/context-engine.ts

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

### packages/context/src/**tests**/context.test.ts

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

### packages/core/src/config.ts

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
  symbol_weight: z.number().min(0).max(1).default(0.2),
  path_weight: z.number().min(0).max(1).default(0.15),
  dependency_weight: z.number().min(0).max(1).default(0.15),
  rule_weight: z.number().min(0).max(1).default(0.1),
  recency_weight: z.number().min(0).max(1).default(0.1),
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

### packages/core/src/**tests**/core.test.ts

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

### packages/exporters/src/exporters.ts

````typescript
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
    lines.push(
      `| **Total** | **${pack.tokenUsage.toLocaleString()} / ${pack.tokenBudget.toLocaleString()}** |`,
    );
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
  }
}
````

### packages/indexer/src/**tests**/indexer.test.ts

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Scanner, Indexer } from '../index.js';
import {
  AtlasDatabase,
  runMigrations,
  FileRepository,
  SymbolRepository,
  DependencyRepository,
} from '@codeatlas/storage';

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
    const projRes = db.run(
      'INSERT INTO projects (name, root) VALUES (?, ?)',
      'demo-app',
      tempDir.replace(/\\/g, '/'),
    );
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

### packages/parser/src/**tests**/parser.test.ts

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

### packages/storage/src/migrations.ts

```typescript
import type { AtlasDatabase } from './database.js';
import { createLogger } from '@codeatlas/shared';
const logger = createLogger('storage:migrations');
interface Migration {
const MIGRATIONS: Migration[] = [
export function runMigrations(db: AtlasDatabase): void {
  const applied = new Set(
```

### README.md

```markdown

```

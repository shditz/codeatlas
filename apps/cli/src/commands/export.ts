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
      'Export target: markdown, claude, cursor, copilot, gemini, agents, antigravity, codex, aider, windsurf, cline, trae, deepseek, qwen, lingma, comate, codegeex, kimi, grok, replit, devin, opencode, vellum, openhands, continue, roo, augment, amazonq',
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
        'antigravity',
        'codex',
        'aider',
        'windsurf',
        'cline',
        'trae',
        'deepseek',
        'qwen',
        'lingma',
        'comate',
        'codegeex',
        'kimi',
        'grok',
        'replit',
        'devin',
        'opencode',
        'vellum',
        'openhands',
        'continue',
        'roo',
        'augment',
        'amazonq',
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

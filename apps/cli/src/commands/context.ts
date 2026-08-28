import type { Command } from 'commander';
import chalk from 'chalk';
import { ensureInitialized, openDatabase, getOrCreateProject, loadConfig } from '../utils.js';
import { FileRepository, SearchRepository, DependencyRepository } from '@codeatlas-ai/storage';
import { DependencyGraph } from '@codeatlas-ai/graph';
import { RetrievalEngine } from '@codeatlas-ai/retrieval';
import { Ranker } from '@codeatlas-ai/ranking';
import { ContextEngine } from '@codeatlas-ai/context';
import { RuleEngine } from '@codeatlas-ai/rules';
import type { FileInfo, ProjectMeta } from '@codeatlas-ai/core';

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

        const fileRepo = new FileRepository(db);
        const files = fileRepo.getAll(projectId);
        const filesByPath = new Map<string, FileInfo>(files.map((f) => [f.relativePath, f]));

        const depRepo = new DependencyRepository(db);
        const deps = depRepo.getAll(projectId);
        const graph = new DependencyGraph();
        graph.addEdges(deps);

        const searchRepo = new SearchRepository(db);

        const retrieval = new RetrievalEngine(searchRepo, graph, filesByPath);
        const retrievalResult = retrieval.retrieve(task, parseInt(options.limit, 10));

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

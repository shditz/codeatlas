import type { Command } from 'commander';
import chalk from 'chalk';
import type { SymbolInfo } from '@codeatlas-ai/core';
import { Indexer } from '@codeatlas-ai/indexer';
import { GitService } from '@codeatlas-ai/git';
import { CodebaseAnalyzer } from '@codeatlas-ai/analytics';
import { SymbolRepository } from '@codeatlas-ai/storage';
import { ensureInitialized, openDatabase, getOrCreateProject, loadConfig } from '../utils.js';
import { formatDuration } from '@codeatlas-ai/shared';

export function registerIndexCommand(program: Command): void {
  program
    .command('index')
    .description('Build or update the code index')
    .option('--staged-only', 'Only index files currently staged in git')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed output')
    .action(async (options: { stagedOnly?: boolean; json?: boolean; verbose?: boolean }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const config = loadConfig(cwd);
      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);

      const indexer = new Indexer({
        root: cwd,
        db,
        projectId,
        followSymlinks: config.index.follow_symlinks,
        maxFileSize: config.index.max_file_size,
        includeTests: config.index.include_tests,
      });

      let result;
      const spinner = !options.json
        ? (await import('ora')).default('Initializing...').start()
        : null;

      try {
        if (options.stagedOnly) {
          const git = new GitService(cwd);
          const stagedFiles = git.getStagedChangedFiles();
          if (stagedFiles.length === 0) {
            if (spinner) spinner.info('No staged files found to index.');
            else
              console.log(
                JSON.stringify({ filesIndexed: 0, filesSkipped: 0, duration: 0 }, null, 2),
              );
            db.close();
            return;
          }

          if (spinner) spinner.text = `Indexing ${stagedFiles.length} staged file(s)...`;
          result = await indexer.indexFiles(stagedFiles);
        } else {
          if (spinner) spinner.text = 'Indexing repository...';
          result = await indexer.index();
        }

        if (spinner) spinner.succeed('Indexing complete');
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (spinner) spinner.fail(`Indexing failed: ${errorMsg}`);
        throw err;
      }

      // Compute Code Health & Architectural Insights
      let deadCodeCount = 0;
      let deadSymbolsCount = 0;
      let topComplexSymbols: SymbolInfo[] = [];
      let cycleCount = 0;

      try {
        const analyzer = new CodebaseAnalyzer({ db, projectId, rootDir: cwd });
        const deadItems = analyzer.detectDeadCode();
        deadCodeCount = deadItems.filter((d) => d.kind === 'file').length;
        deadSymbolsCount = deadItems.filter((d) => d.kind === 'symbol').length;
        cycleCount = analyzer.detectCycles().cycleCount;

        const symbolRepo = new SymbolRepository(db);
        topComplexSymbols = symbolRepo.getTopComplex(3, projectId);
      } catch {
        // Non-blocking analysis
      }

      db.close();

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              ...result,
              insights: {
                deadFiles: deadCodeCount,
                deadSymbols: deadSymbolsCount,
                cycles: cycleCount,
                topComplexSymbols,
              },
            },
            null,
            2,
          ),
        );
        return;
      }

      console.log(chalk.bold('\nIndex Results'));
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

      console.log(chalk.bold('\n  🧠 Code Health & Intelligence Insights'));
      if (deadCodeCount > 0 || deadSymbolsCount > 0) {
        console.log(
          `    ${chalk.yellow('⚠')} ${chalk.dim('Potential Dead Code:')} ${chalk.yellow(
            `${deadCodeCount} file(s), ${deadSymbolsCount} orphan symbol(s)`,
          )}`,
        );
      } else {
        console.log(
          `    ${chalk.green('✓')} ${chalk.dim('Dead Code Status:')}   ${chalk.green('No orphaned files detected')}`,
        );
      }

      if (cycleCount > 0) {
        console.log(
          `    ${chalk.red('✗')} ${chalk.dim('Circular Dependencies:')} ${chalk.red(
            `${cycleCount} cycle(s) found`,
          )}`,
        );
      } else {
        console.log(
          `    ${chalk.green('✓')} ${chalk.dim('Architecture:')}       ${chalk.green('Clean DAG (0 dependency cycles)')}`,
        );
      }

      if (topComplexSymbols.length > 0) {
        console.log(`    ${chalk.dim('Complexity Hotspots:')}`);
        for (const sym of topComplexSymbols) {
          const score = sym.cyclomaticComplexity ?? 1;
          const scoreColor = score > 15 ? chalk.red.bold : score > 8 ? chalk.yellow : chalk.dim;
          console.log(
            `      • ${chalk.white(sym.name)} ${scoreColor(`(Complexity: ${score})`)} ${chalk.dim(`in ${sym.filePath}:${sym.line}`)}`,
          );
        }
      }

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

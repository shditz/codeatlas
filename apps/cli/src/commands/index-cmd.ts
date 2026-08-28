import type { Command } from 'commander';
import chalk from 'chalk';
import { Indexer } from '@codeatlas-ai/indexer';
import { ensureInitialized, openDatabase, getOrCreateProject, loadConfig } from '../utils.js';
import { formatDuration } from '@codeatlas-ai/shared';

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

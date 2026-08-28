import type { Command } from 'commander';
import chalk from 'chalk';
import { ensureInitialized, openDatabase, getOrCreateProject } from '../utils.js';
import { RepositoryWatcher } from '@codeatlas-ai/indexer';

export function registerWatchCommand(program: Command): void {
  program
    .command('watch')
    .description('Start real-time background file watcher to auto-update codebase index on changes')
    .option('--debounce <ms>', 'Debounce window in milliseconds', '300')
    .action((options: { debounce?: string }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);
      const debounceMs = parseInt(options.debounce ?? '300', 10) || 300;

      console.log(chalk.bold('CodeAtlas Realtime Watcher'));
      console.log(chalk.dim(`Watching directory: ${cwd}`));
      console.log(chalk.dim(`Debounce: ${debounceMs}ms\n`));
      console.log(chalk.cyan('Press Ctrl+C to stop watching.\n'));

      const watcher = new RepositoryWatcher({
        root: cwd,
        db,
        projectId,
        debounceMs,
        onReindex: (result) => {
          console.log(
            chalk.green(
              `  ✓ [${new Date().toLocaleTimeString()}] Index updated: ${result.filesIndexed} indexed, ${result.filesUpdated} updated, ${result.filesDeleted} removed (${result.duration}ms)`,
            ),
          );
        },
        onError: (err) => {
          console.error(chalk.red(`  ✗ Watcher error: ${err.message}`));
        },
      });

      watcher.start();

      process.on('SIGINT', () => {
        console.log(chalk.yellow('\nStopping watcher...'));
        watcher.stop();
        db.close();
        process.exit(0);
      });
    });
}

import type { Command } from 'commander';
import chalk from 'chalk';
import { ensureInitialized, openDatabase, getOrCreateProject } from '../utils.js';
import { SearchRepository, FileRepository } from '@codeatlas/storage';

export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Search the codebase')
    .option('--limit <n>', 'Max results', '20')
    .option('--json', 'Output as JSON')
    .action(async (query: string, options: { limit: string; json?: boolean }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);
      const searchRepo = new SearchRepository(db);
      const fileRepo = new FileRepository(db);
      const limit = parseInt(options.limit, 10);

      const results = searchRepo.searchFiles(query, limit);

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        db.close();
        return;
      }

      if (results.length === 0) {
        console.log(chalk.yellow(`No results for "${query}".`));
        console.log(chalk.dim('Try indexing first: atlas index'));
        db.close();
        return;
      }

      console.log('');
      console.log(chalk.bold(`Search Results for "${query}"`));
      console.log('');

      for (const result of results) {
        const file = fileRepo.getByPath(projectId, result.relativePath);
        const lang = file?.language ?? 'unknown';
        const rankStr = Math.abs(result.rank ?? 0).toFixed(2);

        console.log(
          `  ${chalk.green(rankStr.padStart(6))}  ${chalk.white(result.relativePath)} ${chalk.dim(`[${lang}]`)}`,
        );

        if (result.snippet) {
          const cleanSnippet = result.snippet.replace(/<\/?b>/g, '').trim();
          const shortSnippet =
            cleanSnippet.length > 100 ? cleanSnippet.slice(0, 100) + '...' : cleanSnippet;
          console.log(`         ${chalk.dim(shortSnippet)}`);
        }
      }

      console.log('');
      console.log(chalk.dim(`${results.length} results`));
      console.log('');

      db.close();
    });
}

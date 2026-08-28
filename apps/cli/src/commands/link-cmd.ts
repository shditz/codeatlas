import type { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ensureInitialized, openDatabase } from '../utils.js';
import { FederationService } from '@codeatlas-ai/storage';

export function registerLinkCommand(program: Command): void {
  program
    .command('link [targetPath]')
    .description('Federate and attach an external repository database to current CodeAtlas index')
    .option('--alias <name>', 'Custom schema alias name')
    .option('--list', 'List all currently attached and federated repositories')
    .option('--json', 'Output raw JSON result')
    .action(
      async (
        targetPath?: string,
        options?: {
          alias?: string;
          list?: boolean;
          json?: boolean;
        },
      ) => {
        const cwd = process.cwd();
        ensureInitialized(cwd);

        const db = openDatabase(cwd);
        const federation = new FederationService(db);

        if (options?.list || !targetPath) {
          const list = federation.listFederated();
          if (options?.json) {
            console.log(JSON.stringify(list, null, 2));
            db.close();
            return;
          }

          console.log(chalk.bold.cyan('\n🔗 Federated Repositories\n'));
          const table = new Table({
            head: [chalk.bold('Seq'), chalk.bold('Schema / Alias'), chalk.bold('Database File')],
          });

          for (const item of list) {
            table.push([
              item.seq,
              chalk.green(item.name),
              item.file || chalk.dim('(in-memory / primary)'),
            ]);
          }

          console.log(table.toString());
          console.log(`\nTotal attached schemas: ${chalk.bold(list.length)}\n`);
          db.close();
          return;
        }

        try {
          const result = federation.attachRepo(targetPath, options?.alias);
          if (options?.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(
              chalk.bold.green(
                `✔ Successfully federated repository '${result.name}' as alias '${result.alias}'!`,
              ),
            );
            console.log(chalk.dim(`  Root: ${result.root}`));
            console.log(chalk.dim(`  Database: ${result.dbPath}\n`));
          }
        } catch (err) {
          console.error(chalk.red(`✖ Failed to federate repository: ${(err as Error).message}`));
          process.exit(1);
        } finally {
          db.close();
        }
      },
    );
}

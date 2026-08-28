import type { Command } from 'commander';
import fs from 'node:fs';
import chalk from 'chalk';
import { getAtlasDir, isInitialized } from '../utils.js';

export function registerCleanCommand(program: Command): void {
  program
    .command('clean')
    .description('Remove CodeAtlas data directory')
    .option('--yes', 'Skip confirmation')
    .action(async (options: { yes?: boolean }) => {
      const cwd = process.cwd();

      if (!isInitialized(cwd)) {
        console.log(chalk.yellow('CodeAtlas is not initialized in this directory.'));
        return;
      }

      if (!options.yes) {
        console.log(chalk.yellow('This will remove all CodeAtlas data (.atlas/).'));
        console.log(chalk.dim('Use --yes to confirm.'));
        return;
      }

      const atlasDir = getAtlasDir(cwd);
      fs.rmSync(atlasDir, { recursive: true, force: true });
      console.log(chalk.green('✓') + ' Removed .atlas/');
    });
}

import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { defaultConfig } from '@codeatlas/core';
import { AtlasDatabase, runMigrations } from '@codeatlas/storage';
import {
  getAtlasDir,
  getConfigPath,
  getDbPath,
  isInitialized,
  generateConfigTOML,
} from '../utils.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize CodeAtlas in the current repository')
    .option('--force', 'Reinitialize even if already initialized')
    .action(async (options: { force?: boolean }) => {
      const cwd = process.cwd();

      if (isInitialized(cwd) && !options.force) {
        console.log(chalk.yellow('CodeAtlas is already initialized in this directory.'));
        console.log(chalk.dim('Use --force to reinitialize.'));
        return;
      }

      console.log(chalk.bold('Initializing CodeAtlas...'));
      console.log('');

      const atlasDir = getAtlasDir(cwd);
      fs.mkdirSync(atlasDir, { recursive: true });
      fs.mkdirSync(path.join(atlasDir, 'snapshots'), { recursive: true });
      fs.mkdirSync(path.join(atlasDir, 'cache'), { recursive: true });

      // Create config
      const config = defaultConfig();
      config.project.name = path.basename(cwd);
      const configContent = generateConfigTOML(config);
      fs.writeFileSync(getConfigPath(cwd), configContent, 'utf-8');

      // Initialize database
      const db = new AtlasDatabase(getDbPath(cwd));
      runMigrations(db);

      // Create project record
      const normalizedRoot = cwd.replace(/\\/g, '/');
      db.run(
        'INSERT OR IGNORE INTO projects (name, root) VALUES (?, ?)',
        config.project.name,
        normalizedRoot,
      );

      db.close();

      // Create .atlasignore if it doesn't exist
      const ignorePath = path.join(cwd, '.atlasignore');
      if (!fs.existsSync(ignorePath)) {
        fs.writeFileSync(
          ignorePath,
          [
            '# CodeAtlas ignore patterns',
            '.env',
            '.env.*',
            '*.pem',
            '*.key',
            '*.cert',
            'secrets/',
            '',
          ].join('\n'),
          'utf-8',
        );
      }

      console.log(chalk.green('✓') + ' Created .atlas/config.toml');
      console.log(chalk.green('✓') + ' Created .atlas/atlas.db');
      console.log(chalk.green('✓') + ' Created .atlasignore');
      console.log('');
      console.log(chalk.bold('CodeAtlas initialized successfully.'));
      console.log('');
      console.log(chalk.dim('Next steps:'));
      console.log(chalk.dim('  atlas scan    — Discover project structure'));
      console.log(chalk.dim('  atlas index   — Build the code index'));
    });
}

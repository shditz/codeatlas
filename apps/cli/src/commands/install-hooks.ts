import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { GitService } from '@codeatlas-ai/git';
import { ensureInitialized } from '../utils.js';

const PRE_COMMIT_HOOK_CONTENT = `#!/bin/sh
# CodeAtlas pre-commit hook
# Automatically keeps .atlas/atlas.db updated with staged changes

if command -v atlas >/dev/null 2>&1; then
  atlas index --staged-only
elif [ -f "./node_modules/.bin/atlas" ]; then
  ./node_modules/.bin/atlas index --staged-only
fi
`;

export function registerInstallHooksCommand(program: Command): void {
  program
    .command('install-hooks')
    .description('Install Git hooks for automatic incremental indexing on commit')
    .option('--force', 'Overwrite existing pre-commit hook')
    .action(async (options: { force?: boolean }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const git = new GitService(cwd);
      if (!git.isGitRepo()) {
        console.error(chalk.red('Error: Current directory is not a Git repository.'));
        process.exit(1);
      }

      const gitHooksDir = path.join(cwd, '.git', 'hooks');
      if (!fs.existsSync(gitHooksDir)) {
        fs.mkdirSync(gitHooksDir, { recursive: true });
      }

      const preCommitPath = path.join(gitHooksDir, 'pre-commit');

      if (fs.existsSync(preCommitPath) && !options.force) {
        const existingContent = fs.readFileSync(preCommitPath, 'utf-8');
        if (existingContent.includes('CodeAtlas')) {
          console.log(chalk.yellow('CodeAtlas pre-commit hook is already installed.'));
          return;
        }

        console.log(
          chalk.yellow(
            'A pre-commit hook already exists. Use --force to overwrite it, or manually add "atlas index --staged-only".',
          ),
        );
        return;
      }

      try {
        fs.writeFileSync(preCommitPath, PRE_COMMIT_HOOK_CONTENT, { mode: 0o755 });
        try {
          fs.chmodSync(preCommitPath, 0o755);
        } catch {
          // ignore chmod failure on Windows
        }

        console.log(chalk.bold.green('✓ Git pre-commit hook installed successfully!'));
        console.log('');
        console.log(
          chalk.dim(
            'CodeAtlas will now automatically index staged files during `git commit` in milliseconds.',
          ),
        );
        console.log('');
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to write Git hook: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }
    });
}

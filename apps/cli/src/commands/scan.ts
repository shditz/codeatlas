import type { Command } from 'commander';
import chalk from 'chalk';
import { Scanner } from '@codeatlas/indexer';
import { ensureInitialized, openDatabase, getOrCreateProject, loadConfig } from '../utils.js';

export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Scan and detect repository structure')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const config = loadConfig(cwd);
      const scanner = new Scanner({
        root: cwd,
        followSymlinks: config.index.follow_symlinks,
        maxFileSize: config.index.max_file_size,
        includeTests: config.index.include_tests,
      });

      const result = await scanner.scan();

      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);

      db.run(
        `UPDATE projects SET
         package_manager = ?,
         is_monorepo = ?,
         languages = ?,
         frameworks = ?,
         workspaces = ?,
         updated_at = datetime('now')
         WHERE id = ?`,
        result.detectedPackageManager,
        result.isMonorepo ? 1 : 0,
        JSON.stringify(result.project.languages),
        JSON.stringify(result.project.frameworks),
        JSON.stringify(result.workspaces),
        projectId,
      );

      db.close();

      if (options.json) {
        console.log(
          JSON.stringify(result, (_k, v) => (v instanceof Map ? Object.fromEntries(v) : v), 2),
        );
        return;
      }

      console.log('');
      console.log(chalk.bold('Repository Scan'));
      console.log('');
      console.log(`  ${chalk.dim('Project')}      ${result.project.name}`);
      console.log(`  ${chalk.dim('Files')}        ${result.detectedFiles.toLocaleString()}`);
      console.log(`  ${chalk.dim('Skipped')}      ${result.skippedFiles.toLocaleString()}`);
      console.log(`  ${chalk.dim('Package Mgr')}  ${result.detectedPackageManager}`);
      console.log(`  ${chalk.dim('Monorepo')}     ${result.isMonorepo ? 'yes' : 'no'}`);
      console.log(`  ${chalk.dim('Tests')}        ${result.hasTests ? 'yes' : 'no'}`);
      console.log(`  ${chalk.dim('Docs')}         ${result.hasDocs ? 'yes' : 'no'}`);
      console.log(`  ${chalk.dim('CI')}           ${result.hasCI ? 'yes' : 'no'}`);
      console.log(`  ${chalk.dim('Duration')}     ${result.duration}ms`);
      console.log('');

      console.log(chalk.bold('  Languages'));
      const sorted = [...result.detectedLanguages.entries()].sort((a, b) => b[1] - a[1]);
      for (const [lang, count] of sorted) {
        const bar = '█'.repeat(
          Math.min(Math.ceil((count / Math.max(...sorted.map((s) => s[1]))) * 20), 20),
        );
        console.log(`    ${chalk.dim(lang.padEnd(14))} ${chalk.cyan(bar)} ${count}`);
      }

      if (result.detectedFrameworks.length > 0) {
        console.log('');
        console.log(chalk.bold('  Frameworks'));
        for (const fw of result.detectedFrameworks) {
          console.log(`    ${chalk.green('●')} ${fw}`);
        }
      }

      console.log('');
    });
}

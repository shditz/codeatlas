import type { Command } from 'commander';
import chalk from 'chalk';
import { ensureInitialized, openDatabase, getOrCreateProject } from '../utils.js';
import { FileRepository, DependencyRepository } from '@codeatlas/storage';
import { RuleEngine } from '@codeatlas/rules';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Run health diagnostics on the project')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);

      const fileRepo = new FileRepository(db);
      const depRepo = new DependencyRepository(db);

      const files = fileRepo.getAll(projectId);
      const deps = depRepo.getAll(projectId);

      const ruleEngine = new RuleEngine(cwd);
      const rules = ruleEngine.discover();
      const conflicts = ruleEngine.detectConflicts();
      const issues = ruleEngine.validate();

      const checks: Array<{
        name: string;
        status: 'pass' | 'warn' | 'fail';
        score: number;
        message: string;
      }> = [];

      const indexState = db.get<{ last_indexed: string; file_count: number }>(
        'SELECT last_indexed, file_count FROM index_state WHERE project_id = ?',
        projectId,
      );

      if (!indexState) {
        checks.push({
          name: 'Index',
          status: 'fail',
          score: 0,
          message: 'Not indexed. Run: atlas index',
        });
      } else {
        checks.push({
          name: 'Index',
          status: 'pass',
          score: 95,
          message: `${indexState.file_count} files indexed`,
        });
      }

      if (files.length === 0) {
        checks.push({ name: 'Files', status: 'fail', score: 0, message: 'No files in index' });
      } else {
        checks.push({
          name: 'Files',
          status: 'pass',
          score: 100,
          message: `${files.length} files tracked`,
        });
      }

      if (deps.length === 0 && files.length > 5) {
        checks.push({
          name: 'Dependencies',
          status: 'warn',
          score: 50,
          message: 'No dependencies detected',
        });
      } else {
        checks.push({
          name: 'Dependencies',
          status: 'pass',
          score: 90,
          message: `${deps.length} dependency edges`,
        });
      }

      if (rules.length === 0) {
        checks.push({ name: 'Rules', status: 'warn', score: 60, message: 'No AI rules found' });
      } else if (conflicts.length > 0) {
        checks.push({
          name: 'Rules',
          status: 'warn',
          score: 70,
          message: `${rules.length} rules, ${conflicts.length} conflicts`,
        });
      } else {
        checks.push({
          name: 'Rules',
          status: 'pass',
          score: 95,
          message: `${rules.length} rules, no conflicts`,
        });
      }

      const parseableFiles = files.filter(
        (f) => f.language === 'typescript' || f.language === 'javascript',
      );
      const parsedFiles = parseableFiles.filter((f) => f.symbolCount > 0);
      const coverage =
        parseableFiles.length > 0
          ? Math.round((parsedFiles.length / parseableFiles.length) * 100)
          : 100;
      checks.push({
        name: 'Coverage',
        status: coverage > 80 ? 'pass' : 'warn',
        score: coverage,
        message: `${coverage}% of parseable files have symbols`,
      });

      const overallScore = Math.round(checks.reduce((sum, c) => sum + c.score, 0) / checks.length);

      db.close();

      if (options.json) {
        console.log(JSON.stringify({ overallScore, checks }, null, 2));
        return;
      }

      console.log('');
      console.log(chalk.bold('CodeAtlas Health'));
      console.log('');
      console.log(`  Score: ${colorScore(overallScore)}`);
      console.log('');

      for (const check of checks) {
        const icon =
          check.status === 'pass'
            ? chalk.green('✓')
            : check.status === 'warn'
              ? chalk.yellow('!')
              : chalk.red('✗');
        console.log(
          `  ${icon} ${check.name.padEnd(16)} ${colorScore(check.score).padStart(4)}  ${chalk.dim(check.message)}`,
        );
      }

      if (issues.length > 0) {
        console.log('');
        console.log(
          chalk.dim(`  ${issues.length} rule issues detected. Run: atlas rules validate`),
        );
      }

      console.log('');
    });
}

function colorScore(score: number): string {
  if (score >= 90) return chalk.green(`${score}`);
  if (score >= 70) return chalk.yellow(`${score}`);
  return chalk.red(`${score}`);
}

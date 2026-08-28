import type { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ensureInitialized, openDatabase, getOrCreateProject } from '../utils.js';
import { FileRepository } from '@codeatlas-ai/storage';
import { TaintAnalyzer } from '@codeatlas-ai/analytics';

export function registerAuditCommand(program: Command): void {
  program
    .command('audit')
    .description('Run Static Application Security Testing (SAST) and Data-Flow Taint Analysis')
    .option('--file <path>', 'Audit a specific file only')
    .option('--json', 'Output raw JSON result')
    .option(
      '--fail-on-vulnerabilities',
      'Exit with code 1 if critical or high vulnerabilities are found',
    )
    .action(async (options: { file?: string; json?: boolean; failOnVulnerabilities?: boolean }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);

      const fileRepo = new FileRepository(db);
      let files = fileRepo.getAll(projectId);

      if (options.file) {
        files = files.filter(
          (f) => f.relativePath === options.file || f.path.endsWith(options.file!),
        );
      }

      const analyzer = new TaintAnalyzer({ rootDir: cwd, files });
      const report = analyzer.audit();

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        db.close();
        if (
          options.failOnVulnerabilities &&
          (report.summary.critical > 0 || report.summary.high > 0)
        ) {
          process.exit(1);
        }
        return;
      }

      console.log(chalk.bold.cyan('\n🛡️  CodeAtlas Security Audit & SAST Report\n'));
      console.log(chalk.dim(`Scanned ${report.scannedFiles} indexed files across the codebase.\n`));

      if (report.vulnerabilities.length === 0) {
        console.log(
          chalk.bold.green('✔ No high or critical security vulnerabilities detected! Great job.\n'),
        );
        db.close();
        return;
      }

      const table = new Table({
        head: [
          chalk.bold('Severity'),
          chalk.bold('Type'),
          chalk.bold('Location'),
          chalk.bold('Variable'),
          chalk.bold('Description & Remediation'),
        ],
        colWidths: [12, 20, 25, 15, 45],
        wordWrap: true,
      });

      for (const v of report.vulnerabilities) {
        const sevColor =
          v.severity === 'CRITICAL'
            ? chalk.bold.red
            : v.severity === 'HIGH'
              ? chalk.red
              : v.severity === 'MEDIUM'
                ? chalk.yellow
                : chalk.dim;

        table.push([
          sevColor(v.severity),
          v.type,
          chalk.cyan(`${v.filePath}:${v.line}`),
          v.variable,
          `${v.description}\n${chalk.dim('Fix:')} ${chalk.green(v.remediation)}`,
        ]);
      }

      console.log(table.toString());
      console.log('\nSummary:');
      console.log(`  Critical: ${chalk.red(report.summary.critical)}`);
      console.log(`  High:     ${chalk.red(report.summary.high)}`);
      console.log(`  Medium:   ${chalk.yellow(report.summary.medium)}`);
      console.log(`  Low:      ${chalk.dim(report.summary.low)}`);
      console.log(`  Total:    ${chalk.bold(report.summary.total)}\n`);

      db.close();

      if (
        options.failOnVulnerabilities &&
        (report.summary.critical > 0 || report.summary.high > 0)
      ) {
        process.exit(1);
      }
    });
}

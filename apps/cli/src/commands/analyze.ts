import type { Command } from 'commander';
import chalk from 'chalk';
import { ensureInitialized, openDatabase, getOrCreateProject } from '../utils.js';
import { CodebaseAnalyzer } from '@codeatlas/analytics';

export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description(
      'Run deep architectural graph analytics (dead code, circular dependencies, complexity hotspots)',
    )
    .option('--cycles', 'Only check for circular dependencies')
    .option('--dead-code', 'Only check for dead / unreferenced code')
    .option('--hotspots', 'Only show complexity hotspots and unstable modules')
    .option('--json', 'Output raw JSON result')
    .action(
      async (options: {
        cycles?: boolean;
        deadCode?: boolean;
        hotspots?: boolean;
        json?: boolean;
      }) => {
        const cwd = process.cwd();
        ensureInitialized(cwd);

        const db = openDatabase(cwd);
        const projectId = getOrCreateProject(db, cwd);

        const analyzer = new CodebaseAnalyzer({ db, projectId });
        const report = analyzer.analyze();

        if (options.json) {
          if (options.cycles) {
            console.log(
              JSON.stringify({ cycles: report.cycles, count: report.cycles.length }, null, 2),
            );
          } else if (options.deadCode) {
            console.log(
              JSON.stringify({ deadCode: report.deadCode, count: report.deadCode.length }, null, 2),
            );
          } else if (options.hotspots) {
            console.log(
              JSON.stringify(
                { hotspots: report.hotspots, instabilities: report.instabilities },
                null,
                2,
              ),
            );
          } else {
            console.log(JSON.stringify(report, null, 2));
          }
          db.close();
          return;
        }

        console.log('');
        console.log(chalk.bold.cyan('CodeAtlas Codebase Architecture Analysis'));
        console.log(chalk.dim('='.repeat(50)));

        // Summary
        console.log(
          chalk.bold(
            `Files: ${chalk.green(report.summary.totalFiles)} | Symbols: ${chalk.green(report.summary.totalSymbols)} | Dependencies: ${chalk.green(report.summary.totalEdges)} | Avg Degree: ${chalk.green(report.summary.averageDegree)}`,
          ),
        );
        console.log('');

        const showAll = !options.cycles && !options.deadCode && !options.hotspots;

        // 1. Circular Dependencies
        if (showAll || options.cycles) {
          console.log(chalk.bold.underline('1. Circular Dependency Analysis:'));
          if (report.cycles.length === 0) {
            console.log(chalk.green('  ✓ No circular dependencies detected in the codebase.'));
          } else {
            console.log(
              chalk.red.bold(`  ✖ Found ${report.cycles.length} circular dependency cycle(s):`),
            );
            report.cycles.forEach((cycle, idx) => {
              console.log(chalk.yellow(`    [Cycle ${idx + 1}] `) + cycle.join(chalk.dim(' -> ')));
            });
          }
          console.log('');
        }

        // 2. Dead Code Detection
        if (showAll || options.deadCode) {
          console.log(chalk.bold.underline('2. Dead / Orphaned Code Analysis:'));
          if (report.deadCode.length === 0) {
            console.log(chalk.green('  ✓ No isolated or unreferenced files detected.'));
          } else {
            console.log(
              chalk.yellow(
                `  ⚠ Found ${report.deadCode.length} candidate file(s) with 0 incoming dependencies:`,
              ),
            );
            report.deadCode.slice(0, 15).forEach((item) => {
              console.log(`    - ${chalk.cyan(item.filePath)} ${chalk.dim(`(${item.reason})`)}`);
            });
            if (report.deadCode.length > 15) {
              console.log(chalk.dim(`    ... and ${report.deadCode.length - 15} more`));
            }
          }
          console.log('');
        }

        // 3. Hotspots & High Coupling
        if (showAll || options.hotspots) {
          console.log(chalk.bold.underline('3. High Coupling & Structural Hotspots:'));
          if (report.hotspots.length === 0) {
            console.log(chalk.dim('  No hotspots identified.'));
          } else {
            console.table(
              report.hotspots.slice(0, 8).map((h) => ({
                Module: h.name,
                'In-Degree (Fan-In)': h.inDegree,
                'Out-Degree (Fan-Out)': h.outDegree,
                'Instability (0-1)': h.instability,
                GodObject: h.isGodObject ? 'YES' : 'no',
              })),
            );
          }
          console.log('');
        }

        // 4. Git Technical Debt Hotspots (Code Churn + Coupling)
        if ((showAll || options.hotspots) && report.gitHotspots && report.gitHotspots.length > 0) {
          console.log(chalk.bold.underline('4. Git Technical Debt & Churn Hotspots:'));
          console.table(
            report.gitHotspots.slice(0, 8).map((gh) => ({
              File: gh.filePath,
              Churn: gh.churnScore,
              'Hotspot Score': gh.hotspotScore,
              Risk: gh.riskLevel.toUpperCase(),
              Recommendation: gh.recommendation,
            })),
          );
          console.log('');
        }

        db.close();
      },
    );
}

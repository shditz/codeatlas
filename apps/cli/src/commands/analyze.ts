import type { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ensureInitialized, openDatabase, getOrCreateProject } from '../utils.js';
import { CodebaseAnalyzer } from '@codeatlas-ai/analytics';

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
    .option('--fail-on-cycles', 'Exit with non-zero status if circular dependencies are found')
    .option('--mermaid', 'Output circular dependencies as a Mermaid graph')
    .action(
      async (options: {
        cycles?: boolean;
        deadCode?: boolean;
        hotspots?: boolean;
        json?: boolean;
        failOnCycles?: boolean;
        mermaid?: boolean;
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
          if (options.failOnCycles && report.cycles.length > 0) {
            process.exit(1);
          }
          return;
        }

        console.log('');
        console.log(chalk.bold.cyan('CodeAtlas Codebase Architecture Analysis'));
        console.log(chalk.dim('='.repeat(50)));

        console.log(
          chalk.bold(
            `Files: ${chalk.green(report.summary.totalFiles)} | Symbols: ${chalk.green(report.summary.totalSymbols)} | Dependencies: ${chalk.green(report.summary.totalEdges)} | Avg Degree: ${chalk.green(report.summary.averageDegree)}`,
          ),
        );
        console.log('');

        const showAll = !options.cycles && !options.deadCode && !options.hotspots;

        if (showAll || options.cycles) {
          console.log(chalk.bold.underline('1. Circular Dependency Analysis:'));
          if (report.cycles.length === 0) {
            console.log(chalk.green('  ✓ No circular dependencies detected in the codebase.'));
          } else {
            console.log(
              chalk.red.bold(`  ✖ Found ${report.cycles.length} circular dependency cycle(s):`),
            );

            if (options.mermaid) {
              console.log('');
              console.log(chalk.cyan('```mermaid'));
              console.log(chalk.cyan('flowchart TD'));
              report.cycles.forEach((cycle) => {
                for (let i = 0; i < cycle.length - 1; i++) {
                  const from = cycle[i]!.split('/').pop() || cycle[i]!;
                  const to = cycle[i + 1]!.split('/').pop() || cycle[i + 1]!;
                  console.log(chalk.cyan(`  "${from}" --> "${to}"`));
                }
                const first = cycle[0]!.split('/').pop() || cycle[0]!;
                const last = cycle[cycle.length - 1]!.split('/').pop() || cycle[cycle.length - 1]!;
                console.log(chalk.cyan(`  "${last}" --> "${first}"`));
              });
              console.log(chalk.cyan('```'));
              console.log('');
            } else {
              report.cycles.forEach((cycle, idx) => {
                console.log(
                  chalk.yellow(`    [Cycle ${idx + 1}] `) + cycle.join(chalk.dim(' -> ')),
                );
              });
            }
          }
          console.log('');
        }

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

            const table = new Table({
              head: [chalk.bold('File Path'), chalk.bold('Reason')],
              style: { head: [], border: ['dim'] },
            });

            report.deadCode.slice(0, 15).forEach((item) => {
              table.push([chalk.cyan(item.filePath), chalk.dim(item.reason)]);
            });
            console.log(table.toString());

            if (report.deadCode.length > 15) {
              console.log(chalk.dim(`    ... and ${report.deadCode.length - 15} more`));
            }
          }
          console.log('');
        }

        if (showAll || options.hotspots) {
          console.log(chalk.bold.underline('3. High Coupling & Structural Hotspots:'));
          if (report.hotspots.length === 0) {
            console.log(chalk.dim('  No hotspots identified.'));
          } else {
            const table = new Table({
              head: [
                chalk.bold('Module'),
                chalk.bold('In-Degree'),
                chalk.bold('Out-Degree'),
                chalk.bold('Instability (0-1)'),
                chalk.bold('GodObject'),
              ],
              style: { head: [], border: ['dim'] },
            });

            report.hotspots.slice(0, 8).forEach((h) => {
              table.push([
                h.id,
                h.inDegree.toString(),
                h.outDegree.toString(),
                h.instability.toFixed(2),
                h.isGodObject ? chalk.red('YES') : chalk.green('no'),
              ]);
            });
            console.log(table.toString());
          }
          console.log('');
        }

        if ((showAll || options.hotspots) && report.gitHotspots && report.gitHotspots.length > 0) {
          console.log(chalk.bold.underline('4. Git Technical Debt & Churn Hotspots:'));

          const table = new Table({
            head: [
              chalk.bold('File'),
              chalk.bold('Churn'),
              chalk.bold('Hotspot Score'),
              chalk.bold('Risk'),
              chalk.bold('Recommendation'),
            ],
            style: { head: [], border: ['dim'] },
          });

          report.gitHotspots.slice(0, 8).forEach((gh) => {
            const riskColor =
              gh.riskLevel === 'high'
                ? chalk.red
                : gh.riskLevel === 'medium'
                  ? chalk.yellow
                  : chalk.green;
            table.push([
              gh.filePath,
              gh.churnScore.toString(),
              gh.hotspotScore.toFixed(2),
              riskColor(gh.riskLevel.toUpperCase()),
              chalk.dim(gh.recommendation),
            ]);
          });
          console.log(table.toString());
          console.log('');
        }

        db.close();

        if (options.failOnCycles && report.cycles.length > 0) {
          process.exit(1);
        }
      },
    );
}

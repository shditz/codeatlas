import type { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ensureInitialized, openDatabase, getOrCreateProject, loadConfig } from '../utils.js';
import { CodebaseAnalyzer } from '@codeatlas-ai/analytics';

export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description(
      'Run deep architectural graph analytics (dead code, circular dependencies, complexity hotspots, DDD layer regressions)',
    )
    .option('--cycles', 'Only check for circular dependencies')
    .option('--dead-code', 'Only check for dead / unreferenced code')
    .option('--hotspots', 'Only show complexity hotspots and unstable modules')
    .option('--architecture', 'Only show architecture layer and bounded context violations')
    .option('--json', 'Output raw JSON result')
    .option('--fail-on-cycles', 'Exit with non-zero status if circular dependencies are found')
    .option(
      '--fail-on-architecture',
      'Exit with non-zero status if critical or high architecture violations are found',
    )
    .option('--mermaid', 'Output circular dependencies as a Mermaid graph')
    .action(
      async (options: {
        cycles?: boolean;
        deadCode?: boolean;
        hotspots?: boolean;
        architecture?: boolean;
        json?: boolean;
        failOnCycles?: boolean;
        failOnArchitecture?: boolean;
        mermaid?: boolean;
      }) => {
        const cwd = process.cwd();
        ensureInitialized(cwd);

        const db = openDatabase(cwd);
        const projectId = getOrCreateProject(db, cwd);
        const config = loadConfig(cwd);

        const analyzer = new CodebaseAnalyzer({
          db,
          projectId,
          rootDir: cwd,
          architectureConfig: config.architecture,
        });
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
          } else if (options.architecture) {
            console.log(JSON.stringify(report.architectureReport || {}, null, 2));
          } else {
            console.log(JSON.stringify(report, null, 2));
          }
          db.close();
          if (options.failOnCycles && report.cycles.length > 0) {
            process.exit(1);
          }
          if (
            options.failOnArchitecture &&
            report.architectureReport &&
            (report.architectureReport.summary.critical > 0 ||
              report.architectureReport.summary.high > 0)
          ) {
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

        const showAll =
          !options.cycles && !options.deadCode && !options.hotspots && !options.architecture;

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

        if ((showAll || options.architecture) && report.architectureReport) {
          const arch = report.architectureReport;
          const scoreColor =
            arch.summary.cleanScore >= 90
              ? chalk.bold.green
              : arch.summary.cleanScore >= 70
                ? chalk.bold.yellow
                : chalk.bold.red;

          console.log(
            chalk.bold.underline(
              `5. Architecture Model & DDD Boundary Analysis (Score: ${scoreColor(arch.summary.cleanScore + '/100')}):`,
            ),
          );

          const activeLayers = arch.layers.filter((l) => l.files && l.files.length > 0);
          if (activeLayers.length > 0) {
            console.log(
              chalk.dim(
                `   Layers (${activeLayers.length}): ${activeLayers.map((l) => `${l.name} (${l.files?.length})`).join(' → ')}`,
              ),
            );
          }
          if (arch.boundedContexts.length > 0) {
            console.log(
              chalk.dim(
                `   Bounded Contexts (${arch.boundedContexts.length}): ${arch.boundedContexts.map((c) => c.name).join(', ')}`,
              ),
            );
          }
          console.log('');

          if (arch.violations.length === 0) {
            console.log(
              chalk.green(
                '  ✓ Perfect architectural compliance! No layer regressions or bounded context leaks.',
              ),
            );
          } else {
            console.log(
              chalk.yellow.bold(
                `  ⚠ Found ${arch.violations.length} architectural regression(s) & boundary violation(s):`,
              ),
            );

            const table = new Table({
              head: [
                chalk.bold('Severity'),
                chalk.bold('Type'),
                chalk.bold('Source → Target'),
                chalk.bold('Rule & Remediation'),
              ],
              colWidths: [12, 22, 36, 45],
              wordWrap: true,
              style: { head: [], border: ['dim'] },
            });

            arch.violations.forEach((v) => {
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
                v.violationType,
                `${chalk.cyan(v.sourceFile)}\n${chalk.dim('→')} ${chalk.magenta(v.targetFile)}`,
                `${chalk.bold(v.rule)}\n${chalk.dim('Fix:')} ${chalk.green(v.remediation)}`,
              ]);
            });

            console.log(table.toString());
            console.log('');
          }
        }

        db.close();

        if (options.failOnCycles && report.cycles.length > 0) {
          process.exit(1);
        }

        if (
          options.failOnArchitecture &&
          report.architectureReport &&
          (report.architectureReport.summary.critical > 0 ||
            report.architectureReport.summary.high > 0)
        ) {
          process.exit(1);
        }
      },
    );
}

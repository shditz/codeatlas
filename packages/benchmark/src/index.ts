import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { ALL_DATASETS } from './datasets.js';
import { BenchmarkRunner } from './runner.js';
import type { BenchmarkReport } from './types.js';

async function main() {
  console.log(chalk.bold.cyan('\n🏆 CodeAtlas Intelligence Benchmark Suite'));
  console.log(chalk.dim('Empirical evaluation of AST Retrieval, Token Savings, and Precision\n'));

  const runner = new BenchmarkRunner();
  const reports: BenchmarkReport[] = [];

  for (const dataset of ALL_DATASETS) {
    const report = await runner.run(dataset);
    reports.push(report);

    console.log(chalk.bold.green(`\n📊 Benchmark Results for: ${report.datasetName}`));
    console.log('─'.repeat(78));
    console.log(
      chalk.bold(
        `${'Task ID'.padEnd(28)} ${'Recall'.padStart(8)} ${'Precision'.padStart(10)} ${'Atlas Tokens'.padStart(14)} ${'Savings'.padStart(8)} ${'Latency'.padStart(8)}`,
      ),
    );
    console.log('─'.repeat(78));

    for (const task of report.taskResults) {
      const recallStr = `${Math.round(task.recall * 100)}%`;
      const precStr = `${Math.round(task.precision * 100)}%`;
      const tokensStr = `${task.atlasTokens.toLocaleString()} tkn`;
      const savingsStr = `${task.tokenSavingsPct}%`;
      const latencyStr = `${task.durationMs}ms`;

      console.log(
        `${chalk.cyan(task.taskId.padEnd(28))} ${chalk.green(recallStr.padStart(8))} ${chalk.yellow(precStr.padStart(10))} ${chalk.magenta(tokensStr.padStart(14))} ${chalk.bold.green(savingsStr.padStart(8))} ${chalk.dim(latencyStr.padStart(8))}`,
      );
    }

    console.log('─'.repeat(78));
    console.log(
      chalk.bold(
        `${'Overall Averages'.padEnd(28)} ${chalk.green((Math.round(report.overallRecall * 100) + '%').padStart(8))} ${chalk.yellow((Math.round(report.overallPrecision * 100) + '%').padStart(10))} ${'─'.padStart(14)} ${chalk.bold.green((report.overallTokenSavingsPct + '%').padStart(8))} ${chalk.dim((report.averageLatencyMs + 'ms').padStart(8))}`,
      ),
    );
    console.log('─'.repeat(78));
  }

  // Save report to disk
  const resultsDir = path.resolve(process.cwd(), '.benchmarks', 'results');
  fs.mkdirSync(resultsDir, { recursive: true });

  fs.writeFileSync(path.join(resultsDir, 'report.json'), JSON.stringify(reports, null, 2), 'utf-8');

  // Generate Markdown Leaderboard
  let md = '# 📊 CodeAtlas Empirical Benchmark Results\n\n';
  md +=
    '> Verified automated evaluation measuring context precision, recall, and token reduction.\n\n';

  for (const report of reports) {
    md += `## 📦 Dataset: \`${report.datasetName}\`\n\n`;
    md += `| Task | Recall | Precision | Context Tokens | Token Savings | Latency |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    for (const task of report.taskResults) {
      md += `| \`${task.taskId}\` | **${Math.round(task.recall * 100)}%** | ${Math.round(task.precision * 100)}% | ${task.atlasTokens.toLocaleString()} | **${task.tokenSavingsPct}%** | ${task.durationMs}ms |\n`;
    }

    md += `| **Overall Average** | **${Math.round(report.overallRecall * 100)}%** | **${Math.round(report.overallPrecision * 100)}%** | — | **${report.overallTokenSavingsPct}%** | **${report.averageLatencyMs}ms** |\n\n`;
  }

  fs.writeFileSync(path.join(resultsDir, 'LEADERBOARD.md'), md, 'utf-8');

  console.log(
    chalk.bold.green(
      `\n✅ Benchmark complete! Leaderboard written to .benchmarks/results/LEADERBOARD.md\n`,
    ),
  );
}

main().catch((err) => {
  console.error(chalk.red('Benchmark failed:'), err);
  process.exit(1);
});

import type { Command } from 'commander';
import chalk from 'chalk';
import { ensureInitialized } from '../utils.js';
import { RuleEngine } from '@codeatlas-ai/rules';

export function registerRulesCommand(program: Command): void {
  const rules = program.command('rules').description('Manage AI rules and instructions');

  rules
    .command('list')
    .description('List discovered rules')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const engine = new RuleEngine(cwd);
      const discovered = engine.discover();

      if (options.json) {
        console.log(JSON.stringify(discovered, null, 2));
        return;
      }

      if (discovered.length === 0) {
        console.log(chalk.yellow('No rules discovered.'));
        console.log(
          chalk.dim(
            'Supported files: AGENTS.md, CLAUDE.md, GEMINI.md, .cursorrules, .github/copilot-instructions.md',
          ),
        );
        return;
      }

      console.log('');
      console.log(chalk.bold(`Rules (${discovered.length})`));
      console.log('');

      for (const rule of discovered) {
        const scopeLabel =
          rule.scope === 'global'
            ? chalk.green('GLOBAL')
            : chalk.blue(`PATH: ${rule.pathPattern ?? ''}`);
        console.log(`  ${chalk.white(rule.filePath)}`);
        console.log(
          `    ${chalk.dim('Source:')} ${rule.source}  ${chalk.dim('Scope:')} ${scopeLabel}  ${chalk.dim('Priority:')} ${rule.priority}`,
        );
        const preview = rule.content.trim().split('\n')[0]?.slice(0, 80) ?? '';
        console.log(`    ${chalk.dim(preview)}`);
        console.log('');
      }
    });

  rules
    .command('validate')
    .description('Validate rules and detect conflicts')
    .action(async () => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const engine = new RuleEngine(cwd);
      engine.discover();

      const conflicts = engine.detectConflicts();
      const issues = engine.validate();

      console.log('');
      console.log(chalk.bold('Rule Validation'));
      console.log('');

      if (conflicts.length === 0 && issues.length === 0) {
        console.log(chalk.green('  ✓ No conflicts or issues found.'));
      }

      if (conflicts.length > 0) {
        console.log(chalk.yellow(`  Conflicts (${conflicts.length}):`));
        for (const conflict of conflicts) {
          console.log(`    ${chalk.red('✗')} ${conflict.reason}`);
          console.log(
            `      ${chalk.dim(conflict.ruleA.filePath)} ↔ ${chalk.dim(conflict.ruleB.filePath)}`,
          );
          if (conflict.suggestion) {
            console.log(`      ${chalk.dim('Suggestion: ' + conflict.suggestion)}`);
          }
        }
      }

      if (issues.length > 0) {
        console.log('');
        console.log(chalk.yellow(`  Issues (${issues.length}):`));
        for (const issue of issues) {
          const icon =
            issue.severity === 'error'
              ? chalk.red('✗')
              : issue.severity === 'warning'
                ? chalk.yellow('!')
                : chalk.blue('i');
          console.log(`    ${icon} ${issue.issue}`);
          console.log(`      ${chalk.dim(issue.rule.filePath)}`);
        }
      }

      console.log('');
    });

  rules.action(async () => {
    rules.commands.find((c) => c.name() === 'list')?.parse(process.argv);
  });
}

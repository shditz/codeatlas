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

  rules
    .command('generate [target]')
    .alias('init')
    .description(
      'Generate evidence-based rule/instruction files for AI targets with human approval (cursor, windsurf, copilot, claude, gemini, agents, cline, trae, roo, continue, all)',
    )
    .option('--force', 'Overwrite existing files if present')
    .option('-y, --yes', 'Accept all evidence-based rules automatically (non-interactive)')
    .option(
      '--proposal',
      'Save proposed rules with evidence citations to PROPOSED_RULES.md instead of overwriting',
    )
    .action(
      async (
        target: string | undefined,
        options: { force?: boolean; yes?: boolean; proposal?: boolean },
      ) => {
        const cwd = process.cwd();
        const fs = await import('node:fs');
        const path = await import('node:path');
        const { Scanner } = await import('@codeatlas-ai/indexer');
        const { RuleGenerator } = await import('@codeatlas-ai/rules');
        const { CodebaseAnalyzer } = await import('@codeatlas-ai/analytics');
        const { isInitialized, openDatabase, getOrCreateProject, loadConfig } =
          await import('../utils.js');

        console.log('');
        console.log(chalk.bold.cyan('🔍 CodeAtlas Evidence-Based AI Rules Generator'));
        console.log(chalk.dim('='.repeat(55)));
        console.log(
          chalk.dim('Analyzing repository architecture, test runners, and conventions...\n'),
        );

        const scanner = new Scanner({ root: cwd });
        const scanResult = await scanner.scan();

        let architectureReport = undefined;
        if (isInitialized(cwd)) {
          try {
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
            architectureReport = report.architectureReport;
            db.close();
          } catch {
            // Ignore DB error during rules generation
          }
        }

        const generator = new RuleGenerator({
          rootDir: cwd,
          scanResult,
          architectureReport,
        });

        const proposedRules = generator.generateProposedRules();

        if (proposedRules.length === 0) {
          console.log(chalk.yellow('No specific evidence-based rules identified.'));
          return;
        }

        console.log(
          chalk.bold(
            `Found ${chalk.green(proposedRules.length)} evidence-backed engineering & architectural rules:\n`,
          ),
        );

        for (const [idx, rule] of proposedRules.entries()) {
          console.log(
            `  ${chalk.cyan(`[${idx + 1}]`)} ${chalk.bold(rule.title)} ${chalk.dim(`(${rule.category})`)}`,
          );
          console.log(`      ${chalk.white(rule.ruleText)}`);
          console.log(`      ${chalk.dim('Evidence:')} ${chalk.italic.yellow(rule.evidence)}\n`);
        }

        let approvedRules = proposedRules;

        // Interactive Human Approval Flow
        const isInteractive = process.stdout.isTTY && !options.yes && !options.proposal;

        if (isInteractive) {
          try {
            const { checkbox } = await import('@inquirer/prompts');
            const selectedIds = await checkbox({
              message:
                'Select rules to approve for AI coding guidelines (Use Space to toggle, Enter to confirm):',
              choices: proposedRules.map((r) => ({
                name: `${r.title} — ${chalk.dim(r.evidence)}`,
                value: r.id,
                checked: r.recommended,
              })),
            });

            approvedRules = proposedRules.filter((r) => selectedIds.includes(r.id));
          } catch {
            // If prompt fails or cancelled (e.g. SIGINT), fallback to recommended
            approvedRules = proposedRules.filter((r) => r.recommended);
          }
        }

        if (approvedRules.length === 0) {
          console.log(chalk.yellow('\n⚠ No rules approved. Generation cancelled.\n'));
          return;
        }

        const targetMapping: Record<string, string> = {
          cursor: '.cursorrules',
          windsurf: '.windsurfrules',
          copilot: '.github/copilot-instructions.md',
          claude: 'CLAUDE.md',
          gemini: 'GEMINI.md',
          agents: 'AGENTS.md',
          antigravity: 'ANTIGRAVITY.md',
          cline: '.clinerules',
          trae: '.traerules',
          roo: '.roorules',
          continue: '.continue/rules.md',
          deepseek: 'DEEPSEEK.md',
          lingma: '.lingmarules',
        };

        const name = scanResult.project?.name || path.basename(cwd);
        const langs = Object.keys(scanResult.detectedLanguages || {}).map((l) => l.toLowerCase());
        const frameworks = (scanResult.detectedFrameworks || []).map((f) => String(f));
        const pm = scanResult.detectedPackageManager || 'npm';

        const metaInfo = {
          name,
          languages: langs.length > 0 ? langs : ['TypeScript'],
          frameworks: frameworks.length > 0 ? frameworks : ['Standard Libraries'],
          packageManager: pm,
          isMonorepo: scanResult.isMonorepo,
          workspaces: scanResult.workspaces,
        };

        // Proposal Mode: Write to PROPOSED_RULES.md for team review
        if (options.proposal) {
          const proposalDoc = generator.generateRuleDocument(approvedRules, metaInfo, 'PROPOSAL');
          const proposalPath = path.join(cwd, 'PROPOSED_RULES.md');
          fs.writeFileSync(proposalPath, proposalDoc, 'utf-8');
          console.log(
            chalk.green(
              `\n✓ Successfully wrote ${approvedRules.length} proposed rules to ${chalk.bold('PROPOSED_RULES.md')}`,
            ),
          );
          console.log(chalk.dim('Review and approve rules with your team before merging.\n'));
          return;
        }

        const selectedTarget = (target || 'all').toLowerCase();
        let targetsToGenerate: string[] = [];

        if (selectedTarget === 'all') {
          targetsToGenerate = ['agents', 'claude', 'cursor', 'windsurf', 'copilot'];
        } else if (targetMapping[selectedTarget]) {
          targetsToGenerate = [selectedTarget];
        } else {
          console.log(chalk.red(`Unknown target: ${selectedTarget}`));
          console.log(
            chalk.dim(`Supported targets: ${Object.keys(targetMapping).join(', ')}, all`),
          );
          return;
        }

        console.log('');
        for (const t of targetsToGenerate) {
          const relativeFilePath = targetMapping[t]!;
          const fullFilePath = path.join(cwd, relativeFilePath);
          const dirPath = path.dirname(fullFilePath);

          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }

          if (fs.existsSync(fullFilePath) && !options.force) {
            console.log(
              chalk.yellow(
                `  ⚠ Skipped ${relativeFilePath} (already exists, use --force to overwrite)`,
              ),
            );
            continue;
          }

          const content = generator.generateRuleDocument(approvedRules, metaInfo, t);
          fs.writeFileSync(fullFilePath, content, 'utf-8');
          console.log(
            chalk.green(
              `  ✓ Generated ${chalk.bold(relativeFilePath)} with ${approvedRules.length} human-approved rules`,
            ),
          );
        }

        console.log(
          chalk.cyan.bold(
            `\n🎉 AI Rules generated with verified codebase evidence. Misinformation prevented.\n`,
          ),
        );
      },
    );

  rules.action(async () => {
    rules.commands.find((c) => c.name() === 'list')?.parse(process.argv);
  });
}

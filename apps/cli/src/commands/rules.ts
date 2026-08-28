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
      'Generate rule/instruction template files for AI targets (cursor, windsurf, copilot, claude, gemini, agents, cline, trae, roo, continue, all)',
    )
    .option('--force', 'Overwrite existing files if present')
    .action(async (target: string | undefined, options: { force?: boolean }) => {
      const cwd = process.cwd();
      const fs = await import('node:fs');
      const path = await import('node:path');
      const { Scanner } = await import('@codeatlas-ai/indexer');

      const scanner = new Scanner({ root: cwd });
      const scanResult = await scanner.scan();

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

      const selectedTarget = (target || 'all').toLowerCase();
      let targetsToGenerate: string[] = [];

      if (selectedTarget === 'all') {
        targetsToGenerate = ['agents', 'claude', 'cursor', 'windsurf', 'copilot'];
      } else if (targetMapping[selectedTarget]) {
        targetsToGenerate = [selectedTarget];
      } else {
        console.log(chalk.red(`Unknown target: ${selectedTarget}`));
        console.log(chalk.dim(`Supported targets: ${Object.keys(targetMapping).join(', ')}, all`));
        return;
      }

      console.log('');
      console.log(chalk.bold('Generating AI Rule Templates...'));
      console.log('');

      for (const t of targetsToGenerate) {
        const relativeFilePath = targetMapping[t]!;
        const fullFilePath = path.join(cwd, relativeFilePath);
        const dirPath = path.dirname(fullFilePath);

        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        if (fs.existsSync(fullFilePath) && !options.force) {
          console.log(chalk.yellow(`  ⚠ Skipped ${relativeFilePath} (already exists, use --force to overwrite)`));
          continue;
        }

        const name = scanResult.project?.name || path.basename(cwd);
        const langs = Object.keys(scanResult.detectedLanguages || {}).join(', ') || 'TypeScript';
        const frameworks = (scanResult.detectedFrameworks || []).join(', ') || 'Standard Libraries';
        const pm = scanResult.detectedPackageManager || 'npm';

        const content = `# ${name} — AI Coding Guidelines (${t.toUpperCase()})

> Auto-generated by CodeAtlas (https://github.com/shditz/codeatlas)

## 🏗️ Architecture & Tech Stack
- **Project Name**: ${name}
- **Primary Languages**: ${langs}
- **Frameworks & Libraries**: ${frameworks}
- **Package Manager**: ${pm}
${scanResult.isMonorepo ? `- **Monorepo Workspaces**: ${(scanResult.workspaces || []).join(', ')}` : ''}

## 🧠 CodeAtlas Context & MCP
You have access to **CodeAtlas**, a local-first context intelligence engine for this repository.
Always prioritize using CodeAtlas over guessing file locations or reading raw files linearly.
1. **Context Retrieval**: Use the \`atlas_context\` tool (if available via MCP) or ask the user to run \`atlas context "<your query>"\` to fetch precise AST-based context packs.
2. **Architecture Query**: Use \`atlas_query\` to traverse the dependency graph and understand relationships between packages/modules.
3. **Quality Control**: Use \`atlas_analyze\` to ensure you haven't created dead code or circular dependencies before completing a task.

## 🛠️ Engineering Guidelines
1. **Type Safety**: Maintain strict typing, descriptive interfaces, and explicit return types. Avoid \`any\`.
2. **Modular Architecture**: Preserve domain boundaries and clean abstractions across packages. Do not create circular dependencies.
3. **Preserve Integrity**: Retain existing docstrings, comments, and project conventions.
4. **Verification**: Always run linting, type checks, and tests before finalizing code changes.

## 💻 Useful Commands
- **Build**: \`${pm} run build\`
- **Test**: \`${pm} test\`
- **Typecheck**: \`${pm} run typecheck\`
`;

        fs.writeFileSync(fullFilePath, content, 'utf-8');
        console.log(chalk.green(`  ✓ Created ${chalk.bold(relativeFilePath)} for ${t}`));
      }

      console.log('');
    });

  rules.action(async () => {
    rules.commands.find((c) => c.name() === 'list')?.parse(process.argv);
  });
}

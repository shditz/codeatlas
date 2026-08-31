import type { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import {
  McpServer,
  McpConfigurator,
  MCP_TARGETS,
  ALL_MCP_TARGET_IDS,
  type McpTargetId,
} from '@codeatlas-ai/mcp';
import { ensureInitialized } from '../utils.js';

export function registerMcpCommand(program: Command): void {
  const mcp = program
    .command('mcp')
    .description('Model Context Protocol (MCP) server & automated multi-agent configurator')
    .option('--path <path>', 'Root workspace path', process.cwd())
    .action((options: { path: string }) => {
      const cwd = options.path;
      ensureInitialized(cwd);

      const server = new McpServer(cwd);
      server.startStdioServer();
    });

  mcp
    .command('setup')
    .alias('install')
    .description(
      'Automatically configure CodeAtlas MCP for AI coding assistants (Antigravity, Cursor, Claude, Windsurf, Roo, etc.)',
    )
    .option('--all', 'Configure all detected and standard AI assistants')
    .option('-t, --target <targets...>', 'Specify target AI assistants to configure')
    .option('--dry-run', 'Preview configuration changes without writing files to disk')
    .option('--scope <scope>', 'Configuration scope (workspace | global | both)')
    .action(
      async (options: {
        all?: boolean;
        target?: string[];
        dryRun?: boolean;
        scope?: 'workspace' | 'global' | 'both';
      }) => {
        const cwd = process.cwd();
        ensureInitialized(cwd);

        console.log(chalk.bold.cyan('\n🧭 CodeAtlas Universal MCP Configurator\n'));

        const configurator = new McpConfigurator(cwd);
        const detected = configurator.detectAssistants();

        let targetIds: McpTargetId[] = [];

        if (options.target && options.target.length > 0) {
          const validTargets: McpTargetId[] = [];
          for (const t of options.target) {
            const matched = ALL_MCP_TARGET_IDS.find(
              (id) =>
                id.toLowerCase() === t.toLowerCase() ||
                MCP_TARGETS[id].name.toLowerCase().includes(t.toLowerCase()),
            );
            if (matched) {
              validTargets.push(matched);
            } else {
              console.log(chalk.yellow(`⚠ Unknown target: "${t}". Skipping.`));
            }
          }
          targetIds = validTargets;
        } else if (options.all) {
          targetIds =
            detected.length > 0
              ? detected.map((d) => d.id)
              : ['antigravity', 'cursor', 'universal'];
        } else {
          try {
            const { checkbox } = await import('@inquirer/prompts');

            const choices = ALL_MCP_TARGET_IDS.map((id) => {
              const def = MCP_TARGETS[id];
              const isDet = detected.some((d) => d.id === id);
              const badge = isDet ? chalk.green(' (detected)') : '';
              return {
                name: `${def.name}${badge} — ${chalk.dim(def.description)}`,
                value: id,
                checked: isDet || id === 'antigravity' || id === 'cursor' || id === 'universal',
              };
            });

            const selected = await checkbox({
              message: 'Select AI Coding Assistants to configure for CodeAtlas MCP:',
              choices,
            });

            targetIds = selected as McpTargetId[];
          } catch {
            console.log(
              chalk.dim('Non-interactive terminal detected. Configuring detected AI assistants...'),
            );
            targetIds =
              detected.length > 0
                ? detected.map((d) => d.id)
                : ['antigravity', 'cursor', 'universal'];
          }
        }

        if (targetIds.length === 0) {
          console.log(chalk.yellow('\nNo AI assistants selected. Exiting.\n'));
          return;
        }

        console.log(
          chalk.dim(
            `\nConfiguring ${targetIds.length} target(s)${options.dryRun ? ' [DRY-RUN]' : ''}...\n`,
          ),
        );

        const results = await configurator.configureTargets(targetIds, {
          dryRun: options.dryRun,
          scope: options.scope,
        });

        let successCount = 0;
        for (const res of results) {
          if (res.status === 'failed') {
            console.log(`  ${chalk.red('✖')} ${chalk.bold(res.targetName)}`);
            console.log(`    ${chalk.red(res.message)}`);
          } else {
            successCount++;
            const icon = res.status === 'merged' ? chalk.yellow('⚡') : chalk.green('✔');
            console.log(`  ${icon} ${chalk.bold(res.targetName)}`);
            if (res.filePath) {
              console.log(`    ${chalk.dim('Config:')} ${chalk.white(res.filePath)}`);
            }
            if (res.backupPath) {
              console.log(`    ${chalk.dim('Backup:')} ${chalk.gray(res.backupPath)}`);
            }
            console.log(`    ${chalk.green(res.message)}`);
          }
          console.log('');
        }

        if (successCount > 0) {
          console.log(
            chalk.bold.green(
              `🎉 Successfully configured ${successCount}/${targetIds.length} AI assistant(s)!`,
            ),
          );
          console.log(
            chalk.dim(
              '   Restart your AI coding assistant or reload the window to start using the 16 CodeAtlas MCP tools.\n',
            ),
          );
        }
      },
    );

  mcp
    .command('list-targets')
    .alias('targets')
    .description('List all supported AI coding assistant MCP targets and detection status')
    .action(() => {
      const cwd = process.cwd();
      const configurator = new McpConfigurator(cwd);
      const detectedMap = new Map(configurator.detectAssistants().map((d) => [d.id, d]));

      console.log(chalk.bold.cyan('\n📋 Supported AI Coding Assistant MCP Targets\n'));

      const table = new Table({
        head: [
          chalk.cyan('Target ID'),
          chalk.cyan('Assistant Name'),
          chalk.cyan('Scope'),
          chalk.cyan('Detected'),
          chalk.cyan('Configured'),
        ],
        style: { head: [], border: [] },
      });

      for (const id of ALL_MCP_TARGET_IDS) {
        const def = MCP_TARGETS[id];
        const det = detectedMap.get(id);
        const isDetected = !!det;
        const isConfigured = det?.isConfigured ?? false;

        table.push([
          chalk.white(id),
          chalk.bold(def.name),
          chalk.dim(def.scope),
          isDetected ? chalk.green('Yes') : chalk.dim('No'),
          isConfigured ? chalk.green('✔ Configured') : chalk.gray('Not yet'),
        ]);
      }

      console.log(table.toString());
      console.log(
        chalk.dim('\nRun ') +
          chalk.cyan('atlas mcp setup') +
          chalk.dim(' to automatically configure selected assistants.\n'),
      );
    });
}

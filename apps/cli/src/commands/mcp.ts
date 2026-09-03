import type { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import {
  McpServer,
  McpConfigurator,
  MCP_TARGETS,
  ALL_MCP_TARGET_IDS,
  resolveMcpCommand,
  type McpTargetId,
} from '@codeatlas-ai/mcp';
import { isInitialized } from '../utils.js';

function findAtlasRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, '.atlas'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

export function registerMcpCommand(program: Command): void {
  const mcp = program
    .command('mcp')
    .description('Model Context Protocol (MCP) server & automated multi-agent configurator')
    .option('--path <path>', 'Root workspace path', process.cwd())
    .action((options: { path?: string }) => {
      // Set MCP mode so all internal logging outputs to stderr
      process.env.CODEATLAS_MCP = '1';
      process.env.MCP_MODE = '1';

      // Redirect console.log & console.info to console.error immediately to guarantee pure JSON-RPC on stdout
      console.log = (...args: unknown[]) => console.error(...args);
      console.info = (...args: unknown[]) => console.error(...args);

      let targetPath = options.path ? path.resolve(options.path) : process.cwd();

      // If .atlas is not directly in targetPath, search upward
      const foundRoot = findAtlasRoot(targetPath);
      if (foundRoot) {
        targetPath = foundRoot;
      }

      const server = new McpServer(targetPath);
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
        if (!isInitialized(cwd)) {
          console.log(
            chalk.yellow(
              'ℹ Note: CodeAtlas is not initialized yet in this directory.\n' +
                '  Configuring MCP assistant(s) now. You can run "atlas index" or call "atlas_index" via MCP anytime.\n',
            ),
          );
        }

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
              '   Restart your AI coding assistant or reload the window to start using CodeAtlas MCP tools.\n',
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

  mcp
    .command('doctor')
    .description(
      'Verify CodeAtlas MCP server health, stdio protocol compliance, and AI assistant configurations',
    )
    .action(async () => {
      const cwd = process.cwd();
      console.log(chalk.bold.cyan('\n🩺 CodeAtlas Universal MCP Diagnostics\n'));

      // 1. Environment info
      console.log(chalk.bold('Environment & Runtime:'));
      console.log(`  OS:        ${process.platform} (${os.release()}) [${os.arch()}]`);
      console.log(`  Node.js:   ${process.version}`);
      console.log(`  Workspace: ${cwd}`);

      const atlasRoot = findAtlasRoot(cwd);
      if (atlasRoot) {
        console.log(`  ${chalk.green('✔')} Found CodeAtlas index at: ${atlasRoot}`);
      } else {
        console.log(
          `  ${chalk.yellow('!')} No .atlas/ index found in workspace or parent directories.`,
        );
      }

      // 2. Command resolution check
      console.log(chalk.bold('\nCommand Resolution:'));
      const resolved = resolveMcpCommand(cwd);
      console.log(`  Command:   ${chalk.cyan(resolved.command)}`);
      console.log(`  Args:      ${chalk.dim(resolved.args.join(' '))}`);
      console.log(
        `  Mode:      ${resolved.isDirectNode ? chalk.green('Direct Node Entrypoint') : chalk.yellow('Wrapper / System Executable')}`,
      );

      // 3. Stdio JSON-RPC Handshake & Protocol Health Check
      console.log(chalk.bold('\nMCP Protocol Handshake & Stdio Purity:'));
      let handshakeSuccess = false;
      let toolCount = 0;
      let nonJsonLeaked = false;
      const leakSamples: string[] = [];

      try {
        const child = spawn(resolved.command, resolved.args, {
          cwd,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
        });

        // Drain stderr to prevent pipe buffer deadlock
        child.stderr.resume();

        const rlOut = readline.createInterface({ input: child.stdout, terminal: false });

        const responses: Array<{ id?: number | string; result?: { tools?: unknown[] } }> = [];
        let toolsSent = false;

        rlOut.on('line', (line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          try {
            const parsed = JSON.parse(trimmed);
            responses.push(parsed);

            // Once initialize response is received, send tools/list
            if (parsed.id === 1 && !toolsSent) {
              toolsSent = true;
              const toolsReq = JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
                params: {},
              });
              child.stdin.write(toolsReq + '\n');
            }
          } catch {
            nonJsonLeaked = true;
            leakSamples.push(trimmed.slice(0, 120));
          }
        });

        // Send initialize
        const initReq = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'codeatlas-doctor', version: '2.1.0' },
          },
        });
        child.stdin.write(initReq + '\n');

        // Fallback: send tools/list after 400ms if not triggered by init response
        setTimeout(() => {
          if (!toolsSent) {
            toolsSent = true;
            const toolsReq = JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/list',
              params: {},
            });
            child.stdin.write(toolsReq + '\n');
          }
        }, 400);

        const cleanupChild = () => {
          try {
            rlOut.close();
            child.stdin.end();
            child.kill();
          } catch {
            // ignore
          }
        };

        // Wait up to 5 seconds for responses
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            cleanupChild();
            resolve();
          }, 4500);

          const interval = setInterval(() => {
            const initRes = responses.find((r) => r.id === 1);
            const toolsRes = responses.find((r) => r.id === 2);
            if (initRes && toolsRes) {
              clearTimeout(timer);
              clearInterval(interval);
              handshakeSuccess = true;
              toolCount = toolsRes.result?.tools?.length ?? 0;
              cleanupChild();
              resolve();
            }
          }, 50);
        });

        if (handshakeSuccess) {
          console.log(`  ${chalk.green('✔')} JSON-RPC 2.0 handshake succeeded`);
          console.log(`  ${chalk.green('✔')} Discovered ${chalk.bold(toolCount)} active MCP tools`);
        } else {
          console.log(`  ${chalk.red('✖')} JSON-RPC handshake timed out or failed`);
        }

        if (nonJsonLeaked) {
          console.log(
            `  ${chalk.red('✖')} Non-JSON data detected on STDOUT (${leakSamples.length} lines):`,
          );
          for (const s of leakSamples.slice(0, 3)) {
            console.log(`    ${chalk.red('⚠')} ${s}`);
          }
        } else {
          console.log(
            `  ${chalk.green('✔')} STDOUT stream is 100% pure JSON-RPC (no log pollution)`,
          );
        }
      } catch (spawnErr) {
        console.log(
          `  ${chalk.red('✖')} Failed to spawn MCP process: ${spawnErr instanceof Error ? spawnErr.message : String(spawnErr)}`,
        );
      }

      // 4. AI Assistants Configuration Audit
      console.log(chalk.bold('\nConfigured AI Assistants Audit:'));
      const configurator = new McpConfigurator(cwd);
      const detected = configurator.detectAssistants();

      const table = new Table({
        head: [chalk.cyan('Assistant'), chalk.cyan('Config Status'), chalk.cyan('Config Path')],
        style: { head: [], border: [] },
      });

      for (const d of detected) {
        table.push([
          chalk.bold(d.name),
          d.isConfigured ? chalk.green('✔ Active') : chalk.gray('Not configured'),
          chalk.dim(d.configPath),
        ]);
      }
      console.log(table.toString());

      // Antigravity Schemas check
      const antigravitySchemasDir = path.join(
        os.homedir(),
        '.gemini',
        'antigravity-ide',
        'mcp',
        'codeatlas',
      );
      if (fs.existsSync(antigravitySchemasDir)) {
        const schemaFiles = fs
          .readdirSync(antigravitySchemasDir)
          .filter((f) => f.endsWith('.json'));
        console.log(
          `\n  ${chalk.green('✔')} Antigravity IDE tool schemas: ${chalk.bold(schemaFiles.length)} schema files installed at ${antigravitySchemasDir}`,
        );
      }

      console.log(chalk.bold.green('\n✨ Diagnostics Complete!\n'));
      process.exit(0);
    });
}

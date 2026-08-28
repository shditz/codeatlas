import type { Command } from 'commander';
import { McpServer } from '@codeatlas-ai/mcp';
import { ensureInitialized } from '../utils.js';

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start Model Context Protocol (MCP) server for AI coding agents over stdio')
    .option('--path <path>', 'Root workspace path', process.cwd())
    .action((options: { path: string }) => {
      const cwd = options.path;
      ensureInitialized(cwd);

      const server = new McpServer(cwd);
      server.startStdioServer();
    });
}

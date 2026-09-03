import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { McpTargetDefinition, McpTargetId } from './types.js';

function getAppDataDir(): string {
  if (process.platform === 'win32') {
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

export const MCP_TARGETS: Record<McpTargetId, McpTargetDefinition> = {
  antigravity: {
    id: 'antigravity',
    name: 'Google Antigravity & Codex / Gemini',
    description: 'Google Antigravity IDE and Gemini agent customization roots',
    scope: 'both',
    format: 'standard',
    getWorkspacePath: (root: string) => path.join(root, '.agents', 'mcp_config.json'),
    getGlobalPath: () => path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json'),
    isDetected: (root: string) =>
      fs.existsSync(path.join(root, '.agents')) ||
      fs.existsSync(path.join(os.homedir(), '.gemini')) ||
      fs.existsSync(path.join(root, 'GEMINI.md')) ||
      fs.existsSync(path.join(root, 'AGENTS.md')),
    postSetup: async (opts) => {
      // 1. Auto-export schemas to ~/.gemini/antigravity-ide/mcp/codeatlas/
      const antigravitySchemasDir = path.join(
        os.homedir(),
        '.gemini',
        'antigravity-ide',
        'mcp',
        'codeatlas',
      );
      try {
        const { McpServer } = await import('../mcp-server.js');
        const srv = new McpServer(opts.workspaceRoot);
        srv.exportSchemas(antigravitySchemasDir);
      } catch {
        // Ignore schema export in isolated/mock test environments
      }

      // 2. Also mirror to ~/.gemini/antigravity/mcp_config.json if that directory exists
      const altGlobalDir = path.join(os.homedir(), '.gemini', 'antigravity');
      if (fs.existsSync(altGlobalDir)) {
        const primaryGlobalPath = path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
        if (fs.existsSync(primaryGlobalPath)) {
          try {
            fs.copyFileSync(primaryGlobalPath, path.join(altGlobalDir, 'mcp_config.json'));
          } catch {
            // ignore
          }
        }
      }

      // 3. Mirror between global ~/.gemini/config and workspace .agents if applicable
      const globalConfigPath = path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
      const wsConfigPath = path.join(opts.workspaceRoot, '.agents', 'mcp_config.json');

      if (
        fs.existsSync(globalConfigPath) &&
        fs.existsSync(path.dirname(wsConfigPath)) &&
        !fs.existsSync(wsConfigPath)
      ) {
        try {
          fs.copyFileSync(globalConfigPath, wsConfigPath);
        } catch {
          // ignore
        }
      }
    },
  },

  cursor: {
    id: 'cursor',
    name: 'Cursor',
    description: 'Cursor AI code editor workspace or user-level configuration',
    scope: 'both',
    format: 'standard',
    getWorkspacePath: (root: string) => path.join(root, '.cursor', 'mcp.json'),
    getGlobalPath: () => path.join(os.homedir(), '.cursor', 'mcp.json'),
    isDetected: (root: string) =>
      fs.existsSync(path.join(root, '.cursor')) ||
      fs.existsSync(path.join(os.homedir(), '.cursor')) ||
      fs.existsSync(path.join(root, '.cursorrules')),
  },

  'claude-desktop': {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    description: 'Anthropic Claude Desktop native desktop app',
    scope: 'global',
    format: 'standard',
    getGlobalPath: () => {
      const appData = getAppDataDir();
      return path.join(appData, 'Claude', 'claude_desktop_config.json');
    },
    isDetected: () => {
      const appData = getAppDataDir();
      return (
        fs.existsSync(path.join(appData, 'Claude')) ||
        fs.existsSync(path.join(appData, 'Claude', 'claude_desktop_config.json'))
      );
    },
  },

  'claude-code': {
    id: 'claude-code',
    name: 'Claude Code CLI',
    description: 'Anthropic Claude Code command-line tool',
    scope: 'both',
    format: 'standard',
    getWorkspacePath: (root: string) => path.join(root, '.claude.json'),
    getGlobalPath: () => path.join(os.homedir(), '.claude.json'),
    isDetected: (root: string) =>
      fs.existsSync(path.join(os.homedir(), '.claude.json')) ||
      fs.existsSync(path.join(os.homedir(), '.claude')) ||
      fs.existsSync(path.join(root, '.claude.json')) ||
      fs.existsSync(path.join(root, 'CLAUDE.md')),
  },

  windsurf: {
    id: 'windsurf',
    name: 'Windsurf (Cascade)',
    description: 'Codeium Windsurf IDE with Cascade agent flow',
    scope: 'both',
    format: 'standard',
    getWorkspacePath: (root: string) => path.join(root, '.windsurf', 'mcp.json'),
    getGlobalPath: () => path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json'),
    isDetected: (root: string) =>
      fs.existsSync(path.join(os.homedir(), '.codeium', 'windsurf')) ||
      fs.existsSync(path.join(root, '.windsurf')) ||
      fs.existsSync(path.join(root, '.windsurfrules')),
  },

  roo: {
    id: 'roo',
    name: 'Roo Code (VS Code)',
    description: 'Roo Code AI agent extension for Visual Studio Code',
    scope: 'global',
    format: 'standard',
    getGlobalPath: () => {
      const appData = getAppDataDir();
      return path.join(
        appData,
        'Code',
        'User',
        'globalStorage',
        'rooveterinaryinc.roo-cline',
        'settings',
        'cline_mcp_settings.json',
      );
    },
    isDetected: () => {
      const appData = getAppDataDir();
      return fs.existsSync(
        path.join(
          appData,
          'Code',
          'User',
          'globalStorage',
          'rooveterinaryinc.roo-cline',
          'settings',
        ),
      );
    },
  },

  cline: {
    id: 'cline',
    name: 'Cline (VS Code)',
    description: 'Cline autonomous AI coding agent extension for VS Code',
    scope: 'global',
    format: 'standard',
    getGlobalPath: () => {
      const appData = getAppDataDir();
      return path.join(
        appData,
        'Code',
        'User',
        'globalStorage',
        'saoudrizwan.claude-dev',
        'settings',
        'cline_mcp_settings.json',
      );
    },
    isDetected: () => {
      const appData = getAppDataDir();
      return fs.existsSync(
        path.join(appData, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings'),
      );
    },
  },

  trae: {
    id: 'trae',
    name: 'Trae IDE',
    description: 'Trae Adaptive AI IDE workspace configuration',
    scope: 'both',
    format: 'standard',
    getWorkspacePath: (root: string) => path.join(root, '.trae', 'mcp.json'),
    getGlobalPath: () => path.join(os.homedir(), '.trae', 'mcp.json'),
    isDetected: (root: string) =>
      fs.existsSync(path.join(root, '.trae')) ||
      fs.existsSync(path.join(os.homedir(), '.trae')) ||
      fs.existsSync(path.join(root, '.traerules')),
  },

  zed: {
    id: 'zed',
    name: 'Zed Editor',
    description: 'High-performance Zed code editor context server',
    scope: 'global',
    format: 'zed',
    getGlobalPath: () => {
      if (process.platform === 'win32') {
        return path.join(
          process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
          'Zed',
          'settings.json',
        );
      }
      return path.join(os.homedir(), '.config', 'zed', 'settings.json');
    },
    isDetected: () => {
      const p =
        process.platform === 'win32'
          ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Zed')
          : path.join(os.homedir(), '.config', 'zed');
      return fs.existsSync(p);
    },
  },

  continue: {
    id: 'continue',
    name: 'Continue.dev',
    description: 'Continue open-source AI assistant for VS Code and JetBrains',
    scope: 'both',
    format: 'continue',
    getWorkspacePath: (root: string) => path.join(root, '.continue', 'config.json'),
    getGlobalPath: () => path.join(os.homedir(), '.continue', 'config.json'),
    isDetected: (root: string) =>
      fs.existsSync(path.join(root, '.continue')) ||
      fs.existsSync(path.join(os.homedir(), '.continue')),
  },

  openhands: {
    id: 'openhands',
    name: 'OpenHands & Devin',
    description: 'OpenHands AI agent and autonomous dev platform',
    scope: 'both',
    format: 'standard',
    getWorkspacePath: (root: string) => path.join(root, '.openhands', 'mcp.json'),
    getGlobalPath: () => path.join(os.homedir(), '.openhands', 'mcp.json'),
    isDetected: (root: string) =>
      fs.existsSync(path.join(root, '.openhands')) ||
      fs.existsSync(path.join(os.homedir(), '.openhands')),
  },

  amazonq: {
    id: 'amazonq',
    name: 'Amazon Q Developer',
    description: 'Amazon Q Developer CLI and IDE extension',
    scope: 'global',
    format: 'standard',
    getGlobalPath: () => path.join(os.homedir(), '.aws', 'amazonq', 'mcp.json'),
    isDetected: () => fs.existsSync(path.join(os.homedir(), '.aws', 'amazonq')),
  },

  codex: {
    id: 'codex',
    name: 'OpenAI Codex & Custom Agents',
    description: 'OpenAI Codex and generic agent workspace configurations',
    scope: 'workspace',
    format: 'standard',
    getWorkspacePath: (root: string) => path.join(root, '.codex', 'mcp.json'),
    getGlobalPath: () => path.join(os.homedir(), '.codex', 'mcp.json'),
    isDetected: (root: string) =>
      fs.existsSync(path.join(root, '.codex')) || fs.existsSync(path.join(os.homedir(), '.codex')),
  },

  universal: {
    id: 'universal',
    name: 'Universal (.mcp.json)',
    description: 'Standard root .mcp.json file for modern AI coding tools and loaders',
    scope: 'workspace',
    format: 'standard',
    getWorkspacePath: (root: string) => path.join(root, '.mcp.json'),
    isDetected: (root: string) => fs.existsSync(path.join(root, '.mcp.json')),
  },
};

export const ALL_MCP_TARGET_IDS = Object.keys(MCP_TARGETS) as McpTargetId[];

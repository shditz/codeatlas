import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export interface ResolvedMcpCommand {
  command: string;
  args: string[];
  platform: NodeJS.Platform;
  isDirectNode: boolean;
}

/**
 * Resolves the optimal, cross-platform executable command and arguments
 * to start the CodeAtlas MCP server from any AI coding assistant.
 *
 * Handles:
 * 1. Windows ENOENT issue when spawning `.cmd` scripts without shell.
 * 2. Absolute path resolution for `--path <workspaceRoot>` so global AI assistants
 *    started from homedir or random CWD bind to the correct project.
 * 3. Direct Node execution if the CLI entry point is discoverable.
 */
export function resolveMcpCommand(workspaceRoot: string): ResolvedMcpCommand {
  const absRoot = path.resolve(workspaceRoot);
  const platform = process.platform;

  // 1. Check if we can locate the direct node entry point of @codeatlas-ai/cli
  const candidateCliPaths: string[] = [];

  // 1a. Check if currently executing process is the CLI script itself
  if (process.argv[1] && process.argv[1].endsWith('.js')) {
    const scriptPath = path.resolve(process.argv[1]);
    if (fs.existsSync(scriptPath)) {
      candidateCliPaths.push(scriptPath);
    }
  }

  // 1b. Check node binary's neighbor node_modules (handles nvm, fnm, asdf, volta, brew)
  const nodeDir = path.dirname(process.execPath);
  candidateCliPaths.push(
    path.join(nodeDir, 'node_modules', '@codeatlas-ai', 'cli', 'dist', 'index.js'),
    path.join(nodeDir, '..', 'lib', 'node_modules', '@codeatlas-ai', 'cli', 'dist', 'index.js'),
  );

  // 1c. Check local project workspace node_modules
  candidateCliPaths.push(
    path.join(absRoot, 'node_modules', '@codeatlas-ai', 'cli', 'dist', 'index.js'),
  );

  // 1d. Check OS global npm locations
  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    candidateCliPaths.push(
      path.join(appData, 'npm', 'node_modules', '@codeatlas-ai', 'cli', 'dist', 'index.js'),
    );
  } else {
    candidateCliPaths.push(
      '/usr/local/lib/node_modules/@codeatlas-ai/cli/dist/index.js',
      path.join(
        os.homedir(),
        '.npm-global',
        'lib',
        'node_modules',
        '@codeatlas-ai',
        'cli',
        'dist',
        'index.js',
      ),
    );
  }

  // 1e. Also check local monorepo checkout if workspace is CodeAtlas
  candidateCliPaths.push(path.join(absRoot, 'apps', 'cli', 'dist', 'index.js'));

  for (const cliPath of candidateCliPaths) {
    if (fs.existsSync(cliPath)) {
      return {
        command: 'node',
        args: [cliPath, 'mcp', '--path', absRoot],
        platform,
        isDirectNode: true,
      };
    }
  }

  // 2. On Windows, bare 'atlas' fails child_process.spawn() with ENOENT because it is a .cmd/.ps1 script.
  // Using cmd.exe /c atlas mcp --path <workspace> is universally supported by all Windows environments.
  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/c', 'atlas', 'mcp', '--path', absRoot],
      platform,
      isDirectNode: false,
    };
  }

  // 3. On POSIX (macOS & Linux), 'atlas' is an executable script or symlink in PATH.
  return {
    command: 'atlas',
    args: ['mcp', '--path', absRoot],
    platform,
    isDirectNode: false,
  };
}

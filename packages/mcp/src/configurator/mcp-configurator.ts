import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '@codeatlas-ai/shared';
import { resolveMcpCommand } from './command-resolver.js';
import { MCP_TARGETS, ALL_MCP_TARGET_IDS } from './targets.js';
import type {
  ConfigureOptions,
  ConfigureResult,
  DetectedAssistant,
  McpTargetDefinition,
  McpTargetId,
} from './types.js';

const logger = createLogger('mcp:configurator');

/**
 * Strips single-line (// ...) and multi-line (/* ... *\/) comments,
 * and trailing commas from JSON/JSONC text while preserving strings.
 */
export function stripJsonComments(json: string): string {
  let insideString = false;
  let stringChar = '';
  let isEscaped = false;
  let result = '';

  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    const nextChar = json[i + 1];

    if (insideString) {
      result += char;
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === stringChar) {
        insideString = false;
      }
    } else {
      if (char === '"' || char === "'") {
        insideString = true;
        stringChar = char;
        result += char;
      } else if (char === '/' && nextChar === '/') {
        // Skip single line comment
        while (i < json.length && json[i] !== '\n' && json[i] !== '\r') {
          i++;
        }
        if (i < json.length) {
          result += json[i];
        }
      } else if (char === '/' && nextChar === '*') {
        // Skip multi line comment
        i += 2;
        while (i < json.length - 1 && !(json[i] === '*' && json[i + 1] === '/')) {
          i++;
        }
        i++; // skip closing slash
      } else {
        result += char;
      }
    }
  }

  // Remove trailing commas before closing braces/brackets
  return result.replace(/,\s*([\]}])/g, '$1');
}

export function safeParseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    const stripped = stripJsonComments(raw);
    return JSON.parse(stripped);
  }
}

export class McpConfigurator {
  private workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  public detectAssistants(): DetectedAssistant[] {
    const detected: DetectedAssistant[] = [];

    for (const id of ALL_MCP_TARGET_IDS) {
      const target = MCP_TARGETS[id];
      const isDetected = target.isDetected ? target.isDetected(this.workspaceRoot) : false;

      const wsPath = target.getWorkspacePath ? target.getWorkspacePath(this.workspaceRoot) : null;
      const globalPath = target.getGlobalPath ? target.getGlobalPath() : null;

      let chosenPath =
        wsPath && (fs.existsSync(wsPath) || target.scope === 'workspace') ? wsPath : globalPath;
      if (!chosenPath && wsPath) chosenPath = wsPath;

      const scope: 'workspace' | 'global' = chosenPath === wsPath ? 'workspace' : 'global';
      const exists = chosenPath ? fs.existsSync(chosenPath) : false;

      let isConfigured = false;
      if (chosenPath && exists) {
        isConfigured = this.checkIfConfigured(chosenPath, target.format);
      }

      if (isDetected || exists) {
        detected.push({
          id: target.id,
          name: target.name,
          description: target.description,
          detectedAt: chosenPath || 'Unknown location',
          configPath: chosenPath || '',
          scope,
          isConfigured,
        });
      }
    }

    return detected;
  }

  public async configureTarget(
    targetId: McpTargetId,
    options?: Partial<ConfigureOptions>,
  ): Promise<ConfigureResult> {
    const target = MCP_TARGETS[targetId];
    if (!target) {
      return {
        targetId,
        targetName: targetId,
        status: 'failed',
        message: `Unknown MCP target: ${targetId}`,
        error: 'INVALID_TARGET',
      };
    }

    const resolved = resolveMcpCommand(this.workspaceRoot);
    const opts: ConfigureOptions = {
      workspaceRoot: this.workspaceRoot,
      force: false,
      dryRun: false,
      scope: target.scope === 'global' ? 'global' : 'workspace',
      customCommand: options?.customCommand ?? resolved.command,
      customArgs: options?.customArgs ?? resolved.args,
      ...options,
    };

    if (target.customSetup) {
      return target.customSetup(opts);
    }

    const targetPath = this.resolveTargetPath(target, opts.scope);
    if (!targetPath) {
      return {
        targetId: target.id,
        targetName: target.name,
        status: 'failed',
        message: `Could not determine configuration path for ${target.name}`,
        error: 'PATH_UNRESOLVED',
      };
    }

    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir) && !opts.dryRun) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const fileExists = fs.existsSync(targetPath);
      let existingContent: Record<string, unknown> = {};
      let backupPath: string | undefined;

      if (fileExists) {
        try {
          const raw = fs.readFileSync(targetPath, 'utf-8');
          existingContent = safeParseJson(raw);
        } catch {
          if (!opts.dryRun) {
            backupPath = `${targetPath}.corrupted.bak`;
            fs.copyFileSync(targetPath, backupPath);
            logger.warn(
              `Existing config at ${targetPath} was invalid JSON. Created backup at ${backupPath}`,
            );
          }
          existingContent = {};
        }

        if (!opts.dryRun && !backupPath) {
          backupPath = `${targetPath}.bak`;
          try {
            fs.copyFileSync(targetPath, backupPath);
          } catch {
            // ignore backup write error
          }
        }
      }

      const command = opts.customCommand || 'atlas';
      const args = opts.customArgs || ['mcp'];
      const mergedConfig = this.mergeConfig(existingContent, target, command, args);

      if (!opts.dryRun) {
        fs.writeFileSync(targetPath, JSON.stringify(mergedConfig, null, 2), 'utf-8');

        if (target.postSetup) {
          try {
            await target.postSetup(opts);
          } catch (postErr) {
            logger.warn(`Post-setup hook for ${target.name} warning: ${postErr}`);
          }
        }
      }

      const status = fileExists ? 'merged' : 'created';
      const verb = opts.dryRun ? '[Dry-Run] Would configure' : fileExists ? 'Updated' : 'Created';
      const message = `${verb} ${target.name} configuration at ${targetPath}`;

      logger.info(message);

      return {
        targetId: target.id,
        targetName: target.name,
        status,
        filePath: targetPath,
        backupPath,
        message,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to configure ${target.name}: ${errorMsg}`);
      return {
        targetId: target.id,
        targetName: target.name,
        status: 'failed',
        filePath: targetPath,
        message: `Failed to configure ${target.name}: ${errorMsg}`,
        error: errorMsg,
      };
    }
  }

  public async configureTargets(
    targetIds: McpTargetId[],
    options?: Partial<ConfigureOptions>,
  ): Promise<ConfigureResult[]> {
    const results: ConfigureResult[] = [];
    for (const id of targetIds) {
      const res = await this.configureTarget(id, options);
      results.push(res);
    }
    return results;
  }

  public async configureAllDetected(
    options?: Partial<ConfigureOptions>,
  ): Promise<ConfigureResult[]> {
    const detected = this.detectAssistants();
    const targetIds =
      detected.length > 0
        ? detected.map((d) => d.id)
        : (['antigravity', 'cursor', 'universal'] as McpTargetId[]);

    return this.configureTargets(targetIds, options);
  }

  private resolveTargetPath(
    target: McpTargetDefinition,
    preferredScope?: 'workspace' | 'global' | 'both',
  ): string | null {
    if (preferredScope === 'workspace' && target.getWorkspacePath) {
      return target.getWorkspacePath(this.workspaceRoot);
    }
    if (preferredScope === 'global' && target.getGlobalPath) {
      return target.getGlobalPath();
    }
    if (target.getWorkspacePath) {
      return target.getWorkspacePath(this.workspaceRoot);
    }
    if (target.getGlobalPath) {
      return target.getGlobalPath();
    }
    return null;
  }

  private mergeConfig(
    existing: Record<string, unknown>,
    target: McpTargetDefinition,
    command: string,
    args: string[],
  ): Record<string, unknown> {
    const isRooOrCline = target.id === 'roo' || target.id === 'cline';

    if (target.format === 'zed') {
      const contextServers = (existing['context_servers'] as Record<string, unknown>) || {};
      return {
        ...existing,
        context_servers: {
          ...contextServers,
          codeatlas: {
            command: {
              path: command,
              args,
            },
          },
        },
      };
    }

    if (target.format === 'continue') {
      const experimental = (existing['experimental'] as Record<string, unknown>) || {};
      const servers = Array.isArray(experimental['modelContextProtocolServers'])
        ? (experimental['modelContextProtocolServers'] as Array<Record<string, unknown>>)
        : [];

      const filtered = servers.filter((s) => {
        const transport = s['transport'] as Record<string, unknown> | undefined;
        return transport?.command !== command && transport?.command !== 'atlas';
      });

      filtered.push({
        transport: {
          type: 'stdio',
          command,
          args,
        },
      });

      return {
        ...existing,
        experimental: {
          ...experimental,
          modelContextProtocolServers: filtered,
        },
      };
    }

    // Standard format (mcpServers.codeatlas)
    const mcpServers = (existing['mcpServers'] as Record<string, unknown>) || {};
    const serverEntry: Record<string, unknown> = {
      command,
      args,
    };

    if (target.id === 'antigravity') {
      serverEntry['$typeName'] = 'exa.cascade_plugins_pb.CascadePluginCommandTemplate';
    }

    if (isRooOrCline) {
      serverEntry['disabled'] = false;
      serverEntry['alwaysAllow'] = [];
    }

    return {
      ...existing,
      mcpServers: {
        ...mcpServers,
        codeatlas: serverEntry,
      },
    };
  }

  private checkIfConfigured(filePath: string, format: string): boolean {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (format === 'continue') {
        return content.includes('codeatlas') || content.includes('"command": "atlas"');
      }
      return content.includes('"codeatlas"');
    } catch {
      return false;
    }
  }
}

export type McpTargetId =
  | 'antigravity'
  | 'cursor'
  | 'claude-code'
  | 'claude-desktop'
  | 'windsurf'
  | 'roo'
  | 'cline'
  | 'trae'
  | 'zed'
  | 'continue'
  | 'openhands'
  | 'amazonq'
  | 'universal';

export type ConfigScope = 'workspace' | 'global' | 'both';

export type ConfigFormat = 'standard' | 'zed' | 'continue' | 'claude-cli';

export interface McpServerConfigEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  alwaysAllow?: string[];
}

export interface McpTargetDefinition {
  id: McpTargetId;
  name: string;
  description: string;
  scope: ConfigScope;
  format: ConfigFormat;
  getGlobalPath?: () => string | null;
  getWorkspacePath?: (workspaceRoot: string) => string | null;
  isDetected?: (workspaceRoot: string) => boolean;
  customSetup?: (options: ConfigureOptions) => Promise<ConfigureResult>;
}

export interface ConfigureOptions {
  workspaceRoot: string;
  force?: boolean;
  dryRun?: boolean;
  scope?: 'workspace' | 'global' | 'both';
  customCommand?: string;
  customArgs?: string[];
}

export interface ConfigureResult {
  targetId: McpTargetId;
  targetName: string;
  status: 'created' | 'merged' | 'skipped' | 'failed' | 'executed';
  filePath?: string;
  backupPath?: string;
  message: string;
  error?: string;
}

export interface DetectedAssistant {
  id: McpTargetId;
  name: string;
  description: string;
  detectedAt: string;
  configPath: string;
  scope: 'workspace' | 'global';
  isConfigured: boolean;
}

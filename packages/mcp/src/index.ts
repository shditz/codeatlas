export { McpServer } from './mcp-server.js';
export type { JsonRpcRequest, JsonRpcResponse, McpTool } from './mcp-server.js';
export {
  McpConfigurator,
  MCP_TARGETS,
  ALL_MCP_TARGET_IDS,
  resolveMcpCommand,
} from './configurator/index.js';
export type { ResolvedMcpCommand } from './configurator/index.js';
export type {
  McpTargetId,
  ConfigScope,
  ConfigFormat,
  McpServerConfigEntry,
  McpTargetDefinition,
  ConfigureOptions,
  ConfigureResult,
  DetectedAssistant,
} from './configurator/index.js';

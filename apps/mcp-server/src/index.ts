import { McpServer } from '@codeatlas-ai/mcp';

const cwd = process.cwd();
const server = new McpServer(cwd);
server.startStdioServer();

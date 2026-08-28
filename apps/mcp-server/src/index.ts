import { McpServer } from '@codeatlas/mcp';

const cwd = process.cwd();
const server = new McpServer(cwd);
server.startStdioServer();

import { describe, it, expect } from 'vitest';
import { McpServer } from '../index.js';

describe('Model Context Protocol (MCP) Server', () => {
  it('handles initialize request and provides capabilities', async () => {
    const server = new McpServer();
    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
    });

    expect(response).not.toBeNull();
    expect(response?.id).toBe(1);
    const result = response?.result as {
      serverInfo: { name: string };
      capabilities: { tools?: unknown; resources?: unknown; prompts?: unknown };
    };
    expect(result.serverInfo.name).toBe('codeatlas-mcp');
    expect(result.capabilities.tools).toBeDefined();
    expect(result.capabilities.resources).toBeDefined();
    expect(result.capabilities.prompts).toBeDefined();
  });

  it('lists registered MCP tools with schema', async () => {
    const server = new McpServer();
    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });

    expect(response?.result).toBeDefined();
    const result = response?.result as { tools: Array<{ name: string }> };
    const toolNames = result.tools.map((t) => t.name);

    expect(toolNames).toContain('atlas_scan');
    expect(toolNames).toContain('atlas_index');
    expect(toolNames).toContain('atlas_search');
    expect(toolNames).toContain('atlas_get_context');
    expect(toolNames).toContain('atlas_graph_query');
    expect(toolNames).toContain('atlas_pr_diff');
    expect(toolNames).toContain('atlas_compress');
    expect(toolNames).toContain('atlas_get_map');
    expect(toolNames).toContain('atlas_get_rules');
    expect(toolNames).toContain('atlas_doctor');
    expect(toolNames).toContain('atlas_analyze');
    expect(toolNames).toContain('atlas_sql_query');
  });

  it('executes atlas_analyze tool successfully', async () => {
    const server = new McpServer();
    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 'tool-analyze',
      method: 'tools/call',
      params: {
        name: 'atlas_analyze',
        arguments: {},
      },
    });

    expect(response?.result).toBeDefined();
    const content = (response?.result as { content: Array<{ text: string }> }).content;
    expect(content[0]?.text).toBeDefined();
    const data = JSON.parse(content[0]!.text);
    expect(data.summary).toBeDefined();
    expect(data.cycles).toBeDefined();
  });

  it('executes atlas_sql_query tool with read-only SQL', async () => {
    const server = new McpServer();
    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 'tool-sql',
      method: 'tools/call',
      params: {
        name: 'atlas_sql_query',
        arguments: {
          sql: "SELECT name FROM sqlite_master WHERE type = 'table'",
        },
      },
    });

    expect(response?.result).toBeDefined();
    const content = (response?.result as { content: Array<{ text: string }> }).content;
    expect(content[0]?.text).toBeDefined();
    const data = JSON.parse(content[0]!.text);
    expect(data.rowCount).toBeDefined();
    expect(Array.isArray(data.rows)).toBe(true);
  });

  it('rejects forbidden write queries in atlas_sql_query', async () => {
    const server = new McpServer();
    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 'tool-sql-forbidden',
      method: 'tools/call',
      params: {
        name: 'atlas_sql_query',
        arguments: {
          sql: 'DROP TABLE projects',
        },
      },
    });

    expect(response?.error).toBeDefined();
    expect(response?.error?.message).toContain('read-only');
  });

  it('lists and reads MCP resources', async () => {
    const server = new McpServer();
    const listRes = await server.handleMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/list',
    });

    const listResult = listRes?.result as { resources: Array<{ uri: string }> };
    const uris = listResult.resources.map((r) => r.uri);
    expect(uris).toContain('atlas://architecture/map');
    expect(uris).toContain('atlas://architecture/rules');
    expect(uris).toContain('atlas://architecture/graph');

    const readRes = await server.handleMessage({
      jsonrpc: '2.0',
      id: 4,
      method: 'resources/read',
      params: { uri: 'atlas://architecture/rules' },
    });
    expect(readRes?.result).toBeDefined();
    const readResult = readRes?.result as { contents: Array<{ uri: string; text: string }> };
    expect(readResult.contents[0]?.uri).toBe('atlas://architecture/rules');
  });

  it('lists and fetches MCP prompt templates', async () => {
    const server = new McpServer();
    const listRes = await server.handleMessage({
      jsonrpc: '2.0',
      id: 5,
      method: 'prompts/list',
    });

    const listResult = listRes?.result as { prompts: Array<{ name: string }> };
    const promptNames = listResult.prompts.map((p) => p.name);
    expect(promptNames).toContain('explain_codebase');
    expect(promptNames).toContain('plan_feature');
    expect(promptNames).toContain('review_pr');

    const getRes = await server.handleMessage({
      jsonrpc: '2.0',
      id: 6,
      method: 'prompts/get',
      params: { name: 'explain_codebase' },
    });
    expect(getRes?.result).toBeDefined();
    const getResult = getRes?.result as {
      messages: Array<{ role: string; content: { text: string } }>;
    };
    expect(getResult.messages.length).toBeGreaterThan(0);
  });

  it('executes ping request', async () => {
    const server = new McpServer();
    const response = await server.handleMessage({
      jsonrpc: '2.0',
      id: 'ping-1',
      method: 'ping',
    });

    expect(response?.id).toBe('ping-1');
    expect(response?.result).toEqual({});
  });
});

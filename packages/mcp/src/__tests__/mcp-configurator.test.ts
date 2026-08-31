import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { McpConfigurator } from '../configurator/mcp-configurator.js';
import { MCP_TARGETS } from '../configurator/targets.js';

describe('McpConfigurator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-mcp-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('detects assistants based on workspace files and rules', () => {
    fs.mkdirSync(path.join(tempDir, '.agents'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, '.cursor'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.claude.json'), '{}');

    const configurator = new McpConfigurator(tempDir);
    const detected = configurator.detectAssistants();

    const detectedIds = detected.map((d) => d.id);
    expect(detectedIds).toContain('antigravity');
    expect(detectedIds).toContain('cursor');
    expect(detectedIds).toContain('claude-code');
  });

  it('configures Google Antigravity in .agents/mcp_config.json', async () => {
    const configurator = new McpConfigurator(tempDir);
    const result = await configurator.configureTarget('antigravity');

    expect(result.status).toBe('created');
    expect(result.targetId).toBe('antigravity');

    const configPath = path.join(tempDir, '.agents', 'mcp_config.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(parsed.mcpServers.codeatlas).toEqual({
      command: 'atlas',
      args: ['mcp'],
    });
  });

  it('configures Cursor in .cursor/mcp.json', async () => {
    const configurator = new McpConfigurator(tempDir);
    const result = await configurator.configureTarget('cursor');

    expect(result.status).toBe('created');
    const configPath = path.join(tempDir, '.cursor', 'mcp.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(parsed.mcpServers.codeatlas).toBeDefined();
    expect(parsed.mcpServers.codeatlas.command).toBe('atlas');
  });

  it('preserves existing servers during deep merge', async () => {
    const cursorDir = path.join(tempDir, '.cursor');
    fs.mkdirSync(cursorDir, { recursive: true });
    const configPath = path.join(cursorDir, 'mcp.json');

    const initialConfig = {
      mcpServers: {
        postgres: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
        },
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
        },
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), 'utf-8');

    const configurator = new McpConfigurator(tempDir);
    const result = await configurator.configureTarget('cursor');

    expect(result.status).toBe('merged');
    expect(result.backupPath).toBeDefined();
    expect(fs.existsSync(result.backupPath!)).toBe(true);

    const updated = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(updated.mcpServers.postgres).toBeDefined();
    expect(updated.mcpServers.github).toBeDefined();
    expect(updated.mcpServers.codeatlas).toEqual({
      command: 'atlas',
      args: ['mcp'],
    });
  });

  it('formats correctly for Zed context_servers schema', async () => {
    const zedDir = path.join(tempDir, '.config', 'zed');
    fs.mkdirSync(zedDir, { recursive: true });
    const zedConfigPath = path.join(zedDir, 'settings.json');

    const originalGetGlobal = MCP_TARGETS.zed.getGlobalPath;
    MCP_TARGETS.zed.getGlobalPath = () => zedConfigPath;

    try {
      const configurator = new McpConfigurator(tempDir);
      const result = await configurator.configureTarget('zed');

      expect(result.status).toBe('created');
      const parsed = JSON.parse(fs.readFileSync(zedConfigPath, 'utf-8'));
      expect(parsed.context_servers.codeatlas).toEqual({
        command: {
          path: 'atlas',
          args: ['mcp'],
        },
      });
    } finally {
      MCP_TARGETS.zed.getGlobalPath = originalGetGlobal;
    }
  });

  it('formats correctly for Continue.dev modelContextProtocolServers array', async () => {
    const configurator = new McpConfigurator(tempDir);
    const result = await configurator.configureTarget('continue', { scope: 'workspace' });

    expect(result.status).toBe('created');
    const configPath = path.join(tempDir, '.continue', 'config.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(parsed.experimental.modelContextProtocolServers).toHaveLength(1);
    expect(parsed.experimental.modelContextProtocolServers[0]).toEqual({
      transport: {
        type: 'stdio',
        command: 'atlas',
        args: ['mcp'],
      },
    });
  });

  it('respects dryRun option and does not write files to disk', async () => {
    const configurator = new McpConfigurator(tempDir);
    const result = await configurator.configureTarget('universal', { dryRun: true });

    expect(result.status).toBe('created');
    expect(result.message).toContain('[Dry-Run]');
    const configPath = path.join(tempDir, '.mcp.json');
    expect(fs.existsSync(configPath)).toBe(false);
  });

  it('configures multiple targets in batch', async () => {
    const configurator = new McpConfigurator(tempDir);
    const results = await configurator.configureTargets([
      'antigravity',
      'cursor',
      'trae',
      'universal',
    ]);

    expect(results).toHaveLength(4);
    expect(results.every((r) => r.status === 'created')).toBe(true);

    expect(fs.existsSync(path.join(tempDir, '.agents', 'mcp_config.json'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.cursor', 'mcp.json'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.trae', 'mcp.json'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.mcp.json'))).toBe(true);
  });
});

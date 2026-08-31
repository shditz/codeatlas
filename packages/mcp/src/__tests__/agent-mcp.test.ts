import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { McpServer } from '../mcp-server.js';
import {
  AtlasDatabase,
  runMigrations,
  FileRepository,
  DependencyRepository,
  SearchRepository,
} from '@codeatlas-ai/storage';

describe('MCP Server Agent-Oriented Tools & Task-Aware Context', () => {
  let tmpDir: string;
  let server: McpServer;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-mcp-agent-test-'));
    const atlasDir = path.join(tmpDir, '.atlas');
    fs.mkdirSync(atlasDir, { recursive: true });

    // Create source directories and physical files for context engine
    fs.mkdirSync(path.join(tmpDir, 'src', 'api'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'src', 'services'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'api', 'router.ts'), 'export class PaymentRouter {}');
    fs.writeFileSync(path.join(tmpDir, 'src', 'services', 'payment.service.ts'), 'export class PaymentService {}');
    fs.writeFileSync(path.join(tmpDir, 'src', 'services', 'payment.service.spec.ts'), 'describe("PaymentService", () => {});');

    const db = new AtlasDatabase(path.join(atlasDir, 'atlas.db'));
    runMigrations(db);

    const normalizedRoot = tmpDir.replace(/\\/g, '/');
    const projRes = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', 'test', normalizedRoot);
    const projectId = Number(projRes.lastInsertRowid);

    const fileRepo = new FileRepository(db);
    const depRepo = new DependencyRepository(db);
    const searchRepo = new SearchRepository(db);

    fileRepo.upsert(projectId, {
      path: path.join(tmpDir, 'src/api/router.ts').replace(/\\/g, '/'),
      relativePath: 'src/api/router.ts',
      extension: '.ts',
      language: 'typescript',
      size: 100,
      hash: 'h1',
      module: 'src',
      isTest: false,
      isGenerated: false,
      symbolCount: 1,
      importCount: 1,
      exportCount: 1,
    });

    fileRepo.upsert(projectId, {
      path: path.join(tmpDir, 'src/services/payment.service.ts').replace(/\\/g, '/'),
      relativePath: 'src/services/payment.service.ts',
      extension: '.ts',
      language: 'typescript',
      size: 200,
      hash: 'h2',
      module: 'src',
      isTest: false,
      isGenerated: false,
      symbolCount: 2,
      importCount: 1,
      exportCount: 1,
    });

    fileRepo.upsert(projectId, {
      path: path.join(tmpDir, 'src/services/payment.service.spec.ts').replace(/\\/g, '/'),
      relativePath: 'src/services/payment.service.spec.ts',
      extension: '.ts',
      language: 'typescript',
      size: 150,
      hash: 'h3',
      module: 'src',
      isTest: true,
      isGenerated: false,
      symbolCount: 1,
      importCount: 1,
      exportCount: 0,
    });

    searchRepo.indexFile(1, 'src/api/router.ts', 'PaymentRouter route post charge');
    searchRepo.indexFile(2, 'src/services/payment.service.ts', 'PaymentService processPayment stripe refund');
    searchRepo.indexFile(3, 'src/services/payment.service.spec.ts', 'describe PaymentService test failed payment refund');

    depRepo.insertBatch(projectId, [
      {
        source: 'src/api/router.ts',
        target: 'src/services/payment.service.ts',
        kind: 'import',
        symbols: ['PaymentService'],
        weight: 1.0,
        confidence: 1.0,
        resolution: 'semantic-ts',
      },
      {
        source: 'src/services/payment.service.spec.ts',
        target: 'src/services/payment.service.ts',
        kind: 'import',
        symbols: ['PaymentService'],
        weight: 1.0,
        confidence: 1.0,
        resolution: 'semantic-ts',
      },
    ]);

    db.close();
    server = new McpServer(tmpDir);
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
    if (fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore windows file lock delay
      }
    }
  });

  it('exposes new agent tools in getTools()', () => {
    const tools = server.getTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain('atlas_trace_execution_path');
    expect(toolNames).toContain('atlas_find_entry_points');
    expect(toolNames).toContain('atlas_calculate_change_surface');
  });

  it('executes atlas_trace_execution_path via MCP', async () => {
    const res = await server.executeTool('atlas_trace_execution_path', {
      fromNode: 'src/api/router.ts',
      toNode: 'src/services/payment.service.ts',
    });

    const parsed = JSON.parse(res);
    expect(parsed.found).toBe(true);
    expect(parsed.pathLength).toBe(2);
    expect(parsed.executionPath.steps[0].confidence).toBe(1.0);
  });

  it('executes atlas_find_entry_points via MCP', async () => {
    const res = await server.executeTool('atlas_find_entry_points', {
      targetNode: 'src/services/payment.service.ts',
    });

    const parsed = JSON.parse(res);
    expect(parsed.entryPointCount).toBeGreaterThanOrEqual(1);
    expect(parsed.entryPoints[0].entryPoint).toBe('src/api/router.ts');
  });

  it('executes atlas_calculate_change_surface via MCP', async () => {
    const res = await server.executeTool('atlas_calculate_change_surface', {
      filePaths: ['src/services/payment.service.ts'],
    });

    const parsed = JSON.parse(res);
    expect(parsed.directlyAffected).toContain('src/api/router.ts');
    expect(parsed.recommendedTestFiles).toContain('src/services/payment.service.spec.ts');
    expect(parsed.riskLevel).toBeDefined();
  });

  it('executes atlas_get_context with intent via MCP', async () => {
    const res = await server.executeTool('atlas_get_context', {
      task: 'fix stripe refund error in PaymentService',
      intent: 'bug',
    });

    const parsed = JSON.parse(res);
    expect(parsed.files.length).toBeGreaterThan(0);
    expect(parsed.task).toBe('fix stripe refund error in PaymentService');
  });
});

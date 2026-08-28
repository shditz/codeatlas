import { describe, it, expect } from 'vitest';
import { DependencyGraph, GraphQueryEngine } from './index.js';
import type { GraphNodeItem, GraphEdgeItem } from './index.js';

describe('Graph Query Engine', () => {
  it('should parse and execute simple node match query', () => {
    const graph = new DependencyGraph();
    const nodes: GraphNodeItem[] = [
      {
        id: 'src/auth.ts',
        label: 'File',
        properties: { name: 'auth.ts', path: 'src/auth.ts', lines: 120 },
      },
      {
        id: 'src/db.ts',
        label: 'File',
        properties: { name: 'db.ts', path: 'src/db.ts', lines: 300 },
      },
    ];

    const engine = new GraphQueryEngine(graph, nodes);
    const result = engine.execute('MATCH (f:File) WHERE f.name = "auth.ts" RETURN f');

    expect(result.count).toBe(1);
    expect(result.rows[0]?.f.name).toBe('auth.ts');
  });

  it('should execute edge traversal query with type and properties', () => {
    const graph = new DependencyGraph();
    const nodes: GraphNodeItem[] = [
      {
        id: 'func:login',
        label: 'Symbol',
        properties: { name: 'login', kind: 'function', file: 'auth.ts' },
      },
      {
        id: 'func:queryUser',
        label: 'Symbol',
        properties: { name: 'queryUser', kind: 'function', file: 'db.ts' },
      },
      {
        id: 'func:renderUI',
        label: 'Symbol',
        properties: { name: 'renderUI', kind: 'function', file: 'ui.ts' },
      },
    ];

    const edges: GraphEdgeItem[] = [
      { source: 'func:login', target: 'func:queryUser', type: 'CALLS' },
      { source: 'func:renderUI', target: 'func:login', type: 'CALLS' },
    ];

    const engine = new GraphQueryEngine(graph, nodes, edges);
    const result = engine.execute(
      'MATCH (s:Symbol {kind: "function"})-[:CALLS]->(t:Symbol) WHERE s.name = "login" RETURN s.name, t.name',
    );

    expect(result.count).toBe(1);
    expect(result.rows[0]?.['s.name']).toBe('login');
    expect(result.rows[0]?.['t.name']).toBe('queryUser');
  });

  it('should filter with CONTAINS and numerical operators', () => {
    const graph = new DependencyGraph();
    const nodes: GraphNodeItem[] = [
      { id: 'file1', label: 'File', properties: { path: 'packages/core/index.ts', lines: 50 } },
      { id: 'file2', label: 'File', properties: { path: 'packages/graph/index.ts', lines: 150 } },
      { id: 'file3', label: 'File', properties: { path: 'apps/cli/index.ts', lines: 500 } },
    ];

    const engine = new GraphQueryEngine(graph, nodes);
    const result = engine.execute(
      'MATCH (f:File) WHERE f.path CONTAINS "packages" AND f.lines > 100 RETURN f.path',
    );

    expect(result.count).toBe(1);
    expect(result.rows[0]?.['f.path']).toBe('packages/graph/index.ts');
  });
});

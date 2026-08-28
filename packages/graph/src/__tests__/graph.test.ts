import { describe, it, expect } from 'vitest';
import { DependencyGraph } from '../index.js';

describe('Dependency Graph', () => {
  it('constructs graph and traverses forward/backward dependencies', () => {
    const graph = new DependencyGraph();

    graph.addEdge({
      source: 'src/auth/auth.controller.ts',
      target: 'src/auth/auth.service.ts',
      kind: 'import',
      symbols: ['AuthService'],
      weight: 1.0,
    });

    graph.addEdge({
      source: 'src/auth/auth.service.ts',
      target: 'src/users/user.service.ts',
      kind: 'import',
      symbols: ['UserService'],
      weight: 1.0,
    });

    graph.addEdge({
      source: 'src/users/user.service.ts',
      target: 'src/database/db.ts',
      kind: 'import',
      symbols: ['db'],
      weight: 1.0,
    });

    expect(graph.getEdgeCount()).toBe(3);
    expect(graph.getAllNodes().size).toBe(4);

    // Direct dependencies (depth 1)
    const directDeps = graph.getDependencies('src/auth/auth.controller.ts', 1);
    expect(directDeps.has('src/auth/auth.service.ts')).toBe(true);
    expect(directDeps.has('src/users/user.service.ts')).toBe(false);

    // Transitive dependencies (depth 2)
    const transitive = graph.getDependencies('src/auth/auth.controller.ts', 2);
    expect(transitive.has('src/users/user.service.ts')).toBe(true);

    // Reverse dependencies (dependents)
    const dependents = graph.getDependents('src/database/db.ts', 2);
    expect(dependents.has('src/users/user.service.ts')).toBe(true);
    expect(dependents.has('src/auth/auth.service.ts')).toBe(true);

    // Shortest path
    const path = graph.getShortestPath('src/auth/auth.controller.ts', 'src/database/db.ts');
    expect(path).toEqual([
      'src/auth/auth.controller.ts',
      'src/auth/auth.service.ts',
      'src/users/user.service.ts',
      'src/database/db.ts',
    ]);
  });

  it('detects communities and clusters nodes using label propagation', () => {
    const graph = new DependencyGraph();

    // Cluster 1 (Auth domain)
    graph.addEdge({
      source: 'auth/a.ts',
      target: 'auth/b.ts',
      kind: 'import',
      symbols: [],
      weight: 2,
    });
    graph.addEdge({
      source: 'auth/b.ts',
      target: 'auth/c.ts',
      kind: 'import',
      symbols: [],
      weight: 2,
    });
    graph.addEdge({
      source: 'auth/c.ts',
      target: 'auth/a.ts',
      kind: 'import',
      symbols: [],
      weight: 2,
    });

    // Cluster 2 (Payment domain)
    graph.addEdge({
      source: 'pay/x.ts',
      target: 'pay/y.ts',
      kind: 'import',
      symbols: [],
      weight: 2,
    });
    graph.addEdge({
      source: 'pay/y.ts',
      target: 'pay/z.ts',
      kind: 'import',
      symbols: [],
      weight: 2,
    });
    graph.addEdge({
      source: 'pay/z.ts',
      target: 'pay/x.ts',
      kind: 'import',
      symbols: [],
      weight: 2,
    });

    const communities = graph.detectCommunities(5);

    expect(communities.get('auth/a.ts')).toBe(communities.get('auth/b.ts'));
    expect(communities.get('auth/b.ts')).toBe(communities.get('auth/c.ts'));
    expect(communities.get('pay/x.ts')).toBe(communities.get('pay/y.ts'));
    expect(communities.get('pay/y.ts')).toBe(communities.get('pay/z.ts'));
    expect(communities.get('auth/a.ts')).not.toBe(communities.get('pay/x.ts'));
  });

  it('computes PageRank centrality scores accurately', () => {
    const graph = new DependencyGraph();

    // Node C is imported by A, B, and D (highest in-degree centrality)
    graph.addEdge({ source: 'A.ts', target: 'C.ts', kind: 'import', symbols: [], weight: 1 });
    graph.addEdge({ source: 'B.ts', target: 'C.ts', kind: 'import', symbols: [], weight: 1 });
    graph.addEdge({ source: 'D.ts', target: 'C.ts', kind: 'import', symbols: [], weight: 1 });
    graph.addEdge({ source: 'C.ts', target: 'E.ts', kind: 'import', symbols: [], weight: 1 });

    const ranks = graph.computePageRank(0.85, 20);

    expect(ranks.get('C.ts')).toBeDefined();
    expect(ranks.get('C.ts')!).toBeGreaterThan(ranks.get('A.ts')!);
    expect(ranks.get('C.ts')!).toBeGreaterThan(ranks.get('B.ts')!);
    expect(graph.getPageRank('C.ts')).toEqual(ranks.get('C.ts'));
    expect(graph.getPageRank('NonExistent.ts')).toBeUndefined();
  });
});

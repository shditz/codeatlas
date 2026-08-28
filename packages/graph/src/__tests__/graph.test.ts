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
});

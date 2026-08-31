import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../dependency-graph.js';

describe('DependencyGraph Agent Intelligence Tools', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();

    graph.addEdge({
      source: 'src/cli/index.ts',
      target: 'src/controllers/user.controller.ts',
      kind: 'import',
      symbols: ['UserController'],
      weight: 1.0,
      confidence: 1.0,
      resolution: 'semantic-ts',
    });

    graph.addEdge({
      source: 'src/controllers/user.controller.ts',
      target: 'src/services/user.service.ts',
      kind: 'import',
      symbols: ['UserService'],
      weight: 1.0,
      confidence: 0.95,
      resolution: 'semantic-ts',
    });

    graph.addEdge({
      source: 'src/services/user.service.ts',
      target: 'src/repositories/user.repository.ts',
      kind: 'implements',
      symbols: ['IUserRepository'],
      weight: 1.2,
      confidence: 1.0,
      resolution: 'semantic-ts',
    });

    graph.addEdge({
      source: 'src/services/user.service.spec.ts',
      target: 'src/services/user.service.ts',
      kind: 'import',
      symbols: ['UserService'],
      weight: 1.0,
      confidence: 1.0,
      resolution: 'semantic-ts',
    });
  });

  it('finds detailed execution path with confidence calculation', () => {
    const path = graph.findExecutionPath('src/cli/index.ts', 'src/repositories/user.repository.ts');
    expect(path).toBeDefined();
    expect(path?.nodes).toEqual([
      'src/cli/index.ts',
      'src/controllers/user.controller.ts',
      'src/services/user.service.ts',
      'src/repositories/user.repository.ts',
    ]);
    expect(path?.steps).toHaveLength(3);
    expect(path?.totalConfidence).toBe(0.95); 
  });

  it('finds top-level ingress entry points', () => {
    const entryPoints = graph.findEntryPoints('src/services/user.service.ts');
    expect(entryPoints.length).toBeGreaterThan(0);

    const cliEntry = entryPoints.find((e) => e.entryPoint === 'src/cli/index.ts');
    expect(cliEntry).toBeDefined();
    expect(cliEntry?.isRoot).toBe(true);
    expect(cliEntry?.distance).toBe(2);
    expect(cliEntry?.callChain).toEqual([
      'src/cli/index.ts',
      'src/controllers/user.controller.ts',
      'src/services/user.service.ts',
    ]);
  });

  it('calculates change surface and blast radius risk', () => {
    const surface = graph.calculateChangeSurface(['src/services/user.service.ts']);

    expect(surface.targetFiles).toEqual(['src/services/user.service.ts']);
    expect(surface.directlyAffected).toContain('src/controllers/user.controller.ts');
    expect(surface.directlyAffected).toContain('src/services/user.service.spec.ts');
    expect(surface.transitivelyAffected).toContain('src/cli/index.ts');
    expect(surface.recommendedTestFiles).toContain('src/services/user.service.spec.ts');
    expect(surface.riskScore).toBeGreaterThan(0);
  });
});

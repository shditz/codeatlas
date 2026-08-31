import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '@codeatlas-ai/graph';
import type { DependencyEdge } from '@codeatlas-ai/core';
import { ArchitectureAnalyzer } from '../index.js';

describe('ArchitectureAnalyzer (True Architecture Model)', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  it('detects clean layered architecture with zero violations', () => {
    const edges: DependencyEdge[] = [
      // Controller -> Service
      { source: 'src/controllers/user.controller.ts', target: 'src/services/user.service.ts', kind: 'import', symbols: ['UserService'], weight: 1 },
      // Service -> Repository
      { source: 'src/services/user.service.ts', target: 'src/repositories/user.repository.ts', kind: 'import', symbols: ['UserRepository'], weight: 1 },
      // Service -> Domain Model
      { source: 'src/services/user.service.ts', target: 'src/domain/user.model.ts', kind: 'import', symbols: ['User'], weight: 1 },
      // Repository -> Domain Model
      { source: 'src/repositories/user.repository.ts', target: 'src/domain/user.model.ts', kind: 'import', symbols: ['User'], weight: 1 },
    ];
    graph.addEdges(edges);

    const analyzer = new ArchitectureAnalyzer({ graph });
    const report = analyzer.analyze();

    expect(report.summary.totalViolations).toBe(0);
    expect(report.summary.cleanScore).toBe(100);
    expect(report.violations).toHaveLength(0);
  });

  it('detects Layer Regression: Controller directly calling Repository', () => {
    const edges: DependencyEdge[] = [
      // Presentation directly accessing Infrastructure!
      {
        source: 'src/controllers/order.controller.ts',
        target: 'src/repositories/order.repository.ts',
        kind: 'import',
        symbols: ['OrderRepository'],
        weight: 1,
      },
    ];
    graph.addEdges(edges);

    const analyzer = new ArchitectureAnalyzer({ graph });
    const report = analyzer.analyze();

    expect(report.summary.totalViolations).toBe(1);
    expect(report.violations[0]?.violationType).toBe('LAYER_REGRESSION');
    expect(report.violations[0]?.sourceLayer).toBe('presentation');
    expect(report.violations[0]?.targetLayer).toBe('infrastructure');
    expect(report.violations[0]?.severity).toBe('HIGH');
    expect(report.violations[0]?.remediation).toContain('Application Service');
  });

  it('detects Dependency Inversion Violation: Domain depending on Infrastructure', () => {
    const edges: DependencyEdge[] = [
      // Domain depending on Infrastructure!
      {
        source: 'src/domain/entities/user.ts',
        target: 'src/infra/database/postgres-client.ts',
        kind: 'import',
        symbols: ['dbQuery'],
        weight: 1,
      },
    ];
    graph.addEdges(edges);

    const analyzer = new ArchitectureAnalyzer({ graph });
    const report = analyzer.analyze();

    expect(report.summary.totalViolations).toBe(1);
    expect(report.violations[0]?.violationType).toBe('LAYER_REGRESSION');
    expect(report.violations[0]?.sourceLayer).toBe('domain');
    expect(report.violations[0]?.targetLayer).toBe('infrastructure');
    expect(report.violations[0]?.severity).toBe('CRITICAL');
  });

  it('detects Clean Architecture Violation: Domain depending on Outer Rings (Application/Presentation)', () => {
    const edges: DependencyEdge[] = [
      // Domain depending on Presentation!
      {
        source: 'src/domain/models/billing.ts',
        target: 'src/controllers/billing.controller.ts',
        kind: 'import',
        symbols: ['BillingRequest'],
        weight: 1,
      },
    ];
    graph.addEdges(edges);

    const analyzer = new ArchitectureAnalyzer({ graph });
    const report = analyzer.analyze();

    expect(report.summary.totalViolations).toBe(1);
    expect(report.violations[0]?.severity).toBe('CRITICAL');
    expect(report.violations[0]?.rule).toContain('Domain must not depend on Outer Layers');
  });

  it('detects Public API bypass across Bounded Contexts', () => {
    const edges: DependencyEdge[] = [
      // Context A (auth) bypassing public API of Context B (billing) by importing private/deep file
      {
        source: 'src/modules/auth/services/login.service.ts',
        target: 'src/modules/billing/internal/tax-calculator.ts',
        kind: 'import',
        symbols: ['computeTax'],
        weight: 1,
      },
    ];
    graph.addEdges(edges);

    const analyzer = new ArchitectureAnalyzer({ graph });
    const report = analyzer.analyze();

    expect(report.summary.totalViolations).toBe(1);
    expect(report.violations[0]?.violationType).toBe('PUBLIC_API_BYPASS');
    expect(report.violations[0]?.sourceContext).toBe('auth');
    expect(report.violations[0]?.targetContext).toBe('billing');
    expect(report.violations[0]?.remediation).toContain('public entry point');
  });

  it('allows cross-context communication when importing from public entrypoint', () => {
    const edges: DependencyEdge[] = [
      // Context A importing from Context B index.ts (Public API)
      {
        source: 'src/modules/auth/services/login.service.ts',
        target: 'src/modules/billing/index.ts',
        kind: 'import',
        symbols: ['BillingService'],
        weight: 1,
      },
    ];
    graph.addEdges(edges);

    const analyzer = new ArchitectureAnalyzer({ graph });
    const report = analyzer.analyze();

    // No public API bypass violation
    expect(report.violations.filter((v) => v.violationType === 'PUBLIC_API_BYPASS')).toHaveLength(0);
  });

  it('enforces custom allow / disallow architecture rules', () => {
    const edges: DependencyEdge[] = [
      { source: 'src/web/router.ts', target: 'src/db/client.ts', kind: 'import', symbols: [], weight: 1 },
    ];
    graph.addEdges(edges);

    const analyzer = new ArchitectureAnalyzer({
      graph,
      config: {
        type: 'custom',
        layers: {
          web: 'src/web/**',
          database: 'src/db/**',
        },
        bounded_contexts: {},
        rules: {
          allow: [],
          disallow: ['web -> database'],
          enforce_public_api: true,
        },
      },
    });

    const report = analyzer.analyze();
    expect(report.summary.totalViolations).toBe(1);
    expect(report.violations[0]?.violationType).toBe('CUSTOM_RULE_VIOLATION');
    expect(report.violations[0]?.rule).toContain('Disallowed dependency: web -> database');
  });
});

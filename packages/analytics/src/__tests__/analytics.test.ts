import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '@codeatlas/graph';
import type { DependencyEdge, FileInfo } from '@codeatlas/core';
import {
  CycleDetector,
  DeadCodeDetector,
  MetricsCalculator,
  CodebaseAnalyzer,
  GitMetricsAnalyzer,
} from '../index.js';

describe('Analytics Engine', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('CycleDetector', () => {
    it('detects no cycles in a DAG', () => {
      const edges: DependencyEdge[] = [
        { source: 'a.ts', target: 'b.ts', kind: 'import', symbols: [], weight: 1 },
        { source: 'b.ts', target: 'c.ts', kind: 'import', symbols: [], weight: 1 },
      ];
      graph.addEdges(edges);

      const detector = new CycleDetector(graph);
      const res = detector.detectCycles();

      expect(res.cycleCount).toBe(0);
      expect(res.cycles).toHaveLength(0);
    });

    it('detects direct circular dependency (A -> B -> A)', () => {
      const edges: DependencyEdge[] = [
        { source: 'a.ts', target: 'b.ts', kind: 'import', symbols: [], weight: 1 },
        { source: 'b.ts', target: 'a.ts', kind: 'import', symbols: [], weight: 1 },
      ];
      graph.addEdges(edges);

      const detector = new CycleDetector(graph);
      const res = detector.detectCycles();

      expect(res.cycleCount).toBe(1);
      expect(res.cycles[0]).toContain('a.ts');
      expect(res.cycles[0]).toContain('b.ts');
    });

    it('detects indirect multi-hop circular dependency (A -> B -> C -> A)', () => {
      const edges: DependencyEdge[] = [
        { source: 'a.ts', target: 'b.ts', kind: 'import', symbols: [], weight: 1 },
        { source: 'b.ts', target: 'c.ts', kind: 'import', symbols: [], weight: 1 },
        { source: 'c.ts', target: 'a.ts', kind: 'import', symbols: [], weight: 1 },
      ];
      graph.addEdges(edges);

      const detector = new CycleDetector(graph);
      const res = detector.detectCycles();

      expect(res.cycleCount).toBe(1);
      expect(res.cycles[0]).toEqual(['a.ts', 'b.ts', 'c.ts', 'a.ts']);
    });
  });

  describe('DeadCodeDetector', () => {
    it('detects orphaned files with no incoming dependencies', () => {
      const edges: DependencyEdge[] = [
        { source: 'src/app.ts', target: 'src/service.ts', kind: 'import', symbols: [], weight: 1 },
        { source: 'src/service.ts', target: 'src/util.ts', kind: 'import', symbols: [], weight: 1 },
      ];
      graph.addEdges(edges);

      const files: FileInfo[] = [
        {
          path: '/repo/src/app.ts',
          relativePath: 'src/app.ts',
          extension: '.ts',
          language: 'typescript',
          size: 100,
          hash: 'h1',
          module: 'src',
          isTest: false,
          isGenerated: false,
          symbolCount: 1,
          importCount: 1,
          exportCount: 0,
        },
        {
          path: '/repo/src/service.ts',
          relativePath: 'src/service.ts',
          extension: '.ts',
          language: 'typescript',
          size: 100,
          hash: 'h2',
          module: 'src',
          isTest: false,
          isGenerated: false,
          symbolCount: 1,
          importCount: 1,
          exportCount: 1,
        },
        {
          path: '/repo/src/unused-legacy.ts',
          relativePath: 'src/unused-legacy.ts',
          extension: '.ts',
          language: 'typescript',
          size: 100,
          hash: 'h3',
          module: 'src',
          isTest: false,
          isGenerated: false,
          symbolCount: 1,
          importCount: 0,
          exportCount: 1,
        },
      ];

      const detector = new DeadCodeDetector(graph, files);
      const deadItems = detector.detectDeadCode();

      expect(deadItems).toHaveLength(1);
      expect(deadItems[0]?.filePath).toBe('src/unused-legacy.ts');
      expect(deadItems[0]?.kind).toBe('file');
    });
  });

  describe('MetricsCalculator', () => {
    it('computes fan-in, fan-out, density, and average degree accurately', () => {
      const edges: DependencyEdge[] = [
        { source: 'a.ts', target: 'b.ts', kind: 'import', symbols: [], weight: 1 },
        { source: 'a.ts', target: 'c.ts', kind: 'import', symbols: [], weight: 1 },
        { source: 'b.ts', target: 'c.ts', kind: 'import', symbols: [], weight: 1 },
      ];
      graph.addEdges(edges);

      const calc = new MetricsCalculator(graph, 3, 10);
      const summary = calc.calculateSummary();
      const nodeMetrics = calc.calculateNodeMetrics();

      expect(summary.totalEdges).toBe(3);
      expect(summary.totalFiles).toBe(3);
      expect(summary.totalSymbols).toBe(10);
      expect(summary.averageDegree).toBe(2);

      const nodeA = nodeMetrics.find((n) => n.id === 'a.ts');
      expect(nodeA?.outDegree).toBe(2);
      expect(nodeA?.inDegree).toBe(0);

      const nodeC = nodeMetrics.find((n) => n.id === 'c.ts');
      expect(nodeC?.inDegree).toBe(2);
      expect(nodeC?.outDegree).toBe(0);
    });
  });

  describe('CodebaseAnalyzer Orchestrator', () => {
    it('produces complete analytics report', () => {
      const edges: DependencyEdge[] = [
        { source: 'a.ts', target: 'b.ts', kind: 'import', symbols: [], weight: 1 },
        { source: 'b.ts', target: 'a.ts', kind: 'import', symbols: [], weight: 1 },
      ];
      graph.addEdges(edges);

      const analyzer = new CodebaseAnalyzer({ graph });
      const report = analyzer.analyze();

      expect(report.cycles).toHaveLength(1);
      expect(report.summary.totalEdges).toBe(2);
      expect(report.hotspots).toBeDefined();
    });
  });

  describe('GitMetricsAnalyzer', () => {
    it('calculates hotspot risk scores based on churn and graph metrics', () => {
      const gitAnalyzer = new GitMetricsAnalyzer(process.cwd());

      const mockNodeMetrics = [
        {
          id: 'src/core/engine.ts',
          name: 'engine.ts',
          inDegree: 12,
          outDegree: 8,
          instability: 0.85,
          isGodObject: true,
          isLeaf: false,
          isRoot: false,
        },
        {
          id: 'src/utils/math.ts',
          name: 'math.ts',
          inDegree: 1,
          outDegree: 0,
          instability: 0.1,
          isGodObject: false,
          isLeaf: true,
          isRoot: false,
        },
      ];

      const customChurnMap = new Map<string, number>([
        ['src/core/engine.ts', 25],
        ['src/utils/math.ts', 1],
      ]);

      const hotspots = gitAnalyzer.analyzeHotspots(mockNodeMetrics, customChurnMap);
      expect(hotspots).toHaveLength(2);
      expect(hotspots[0]?.filePath).toBe('src/core/engine.ts');
      expect(hotspots[0]?.riskLevel).toBe('critical');
      expect(hotspots[1]?.filePath).toBe('src/utils/math.ts');
      expect(hotspots[1]?.riskLevel).toBe('low');
    });
  });
});

import type { DependencyGraph } from '@codeatlas/graph';
import type { NodeMetrics } from '@codeatlas/core';

export interface GraphMetricsSummary {
  totalFiles: number;
  totalSymbols: number;
  totalEdges: number;
  graphDensity: number;
  averageDegree: number;
}

export class MetricsCalculator {
  private graph: DependencyGraph;
  private totalFiles: number;
  private totalSymbols: number;

  constructor(graph: DependencyGraph, totalFiles: number = 0, totalSymbols: number = 0) {
    this.graph = graph;
    this.totalFiles = totalFiles || graph.getAllNodes().size;
    this.totalSymbols = totalSymbols;
  }

  calculateNodeMetrics(): NodeMetrics[] {
    const nodes = Array.from(this.graph.getAllNodes());
    const metrics: NodeMetrics[] = [];

    for (const node of nodes) {
      const inDegree = this.graph.getDirectDependents(node).length;
      const outDegree = this.graph.getDirectDependencies(node).length;
      const totalDegree = inDegree + outDegree;
      const instability = totalDegree > 0 ? Number((outDegree / totalDegree).toFixed(3)) : 0;

      metrics.push({
        id: node,
        name: node.split('/').pop() || node,
        inDegree,
        outDegree,
        instability,
        isGodObject: totalDegree >= 10,
        isLeaf: outDegree === 0 && inDegree > 0,
        isRoot: inDegree === 0 && outDegree > 0,
      });
    }

    return metrics.sort((a, b) => b.inDegree + b.outDegree - (a.inDegree + a.outDegree));
  }

  calculateSummary(): GraphMetricsSummary {
    const nodeCount = this.graph.getAllNodes().size;
    const edgeCount = this.graph.getEdgeCount();

    const maxEdges = nodeCount > 1 ? nodeCount * (nodeCount - 1) : 1;
    const graphDensity = nodeCount > 1 ? Number((edgeCount / maxEdges).toFixed(4)) : 0;
    const averageDegree = nodeCount > 0 ? Number(((edgeCount * 2) / nodeCount).toFixed(2)) : 0;

    return {
      totalFiles: this.totalFiles,
      totalSymbols: this.totalSymbols,
      totalEdges: edgeCount,
      graphDensity,
      averageDegree,
    };
  }

  getHotspots(limit: number = 10): NodeMetrics[] {
    const metrics = this.calculateNodeMetrics();
    return metrics.slice(0, limit);
  }

  getHighInstabilities(limit: number = 10): NodeMetrics[] {
    const metrics = this.calculateNodeMetrics();
    return metrics.filter((m) => m.outDegree > 2 && m.instability >= 0.8).slice(0, limit);
  }
}

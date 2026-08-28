import type { DependencyGraph } from '@codeatlas-ai/graph';
import type { CycleDetectionResult } from '@codeatlas-ai/core';

export class CycleDetector {
  private graph: DependencyGraph;

  constructor(graph: DependencyGraph) {
    this.graph = graph;
  }

  detectCycles(): CycleDetectionResult {
    const nodes: string[] = Array.from(this.graph.getAllNodes());
    const adj = new Map<string, string[]>();

    for (const node of nodes) {
      const edges = this.graph.getDirectDependencies(node);
      adj.set(
        node,
        edges.map((e: { target: string }) => e.target),
      );
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];
    const rawCycles: string[][] = [];

    const dfs = (current: string) => {
      visited.add(current);
      recStack.add(current);
      path.push(current);

      const neighbors = adj.get(current) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStack.has(neighbor)) {
          const startIndex = path.indexOf(neighbor);
          if (startIndex !== -1) {
            const cycle = path.slice(startIndex);
            cycle.push(neighbor);
            rawCycles.push(cycle);
          }
        }
      }

      path.pop();
      recStack.delete(current);
    };

    for (const node of nodes) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    const uniqueCycles = this.deduplicateCycles(rawCycles);

    return {
      cycles: uniqueCycles,
      cycleCount: uniqueCycles.length,
    };
  }

  private deduplicateCycles(cycles: string[][]): string[][] {
    const seen = new Set<string>();
    const result: string[][] = [];

    for (const cycle of cycles) {
      if (cycle.length < 2) continue;
      const core = cycle.slice(0, -1);
      const canonical = this.getCanonicalCycleString(core);

      if (!seen.has(canonical)) {
        seen.add(canonical);
        result.push(cycle);
      }
    }

    return result;
  }

  private getCanonicalCycleString(nodes: string[]): string {
    if (nodes.length === 0) return '';
    let minIndex = 0;
    for (let i = 1; i < nodes.length; i++) {
      if (nodes[i]! < nodes[minIndex]!) {
        minIndex = i;
      }
    }

    const rotated = [...nodes.slice(minIndex), ...nodes.slice(0, minIndex)];
    return rotated.join(' -> ');
  }
}

import type { DependencyEdge } from '@codeatlas/core';

export class DependencyGraph {
  private outgoing = new Map<string, DependencyEdge[]>();
  private incoming = new Map<string, DependencyEdge[]>();
  private nodes = new Set<string>();

  addEdge(edge: DependencyEdge): void {
    this.nodes.add(edge.source);
    this.nodes.add(edge.target);

    const outEdges = this.outgoing.get(edge.source) ?? [];
    outEdges.push(edge);
    this.outgoing.set(edge.source, outEdges);

    const inEdges = this.incoming.get(edge.target) ?? [];
    inEdges.push(edge);
    this.incoming.set(edge.target, inEdges);
  }

  addEdges(edges: DependencyEdge[]): void {
    for (const edge of edges) {
      this.addEdge(edge);
    }
  }

  getDependencies(node: string, maxDepth: number = 1): Set<string> {
    const result = new Set<string>();
    this.traverseOutgoing(node, maxDepth, 0, result);
    result.delete(node);
    return result;
  }

  getDependents(node: string, maxDepth: number = 1): Set<string> {
    const result = new Set<string>();
    this.traverseIncoming(node, maxDepth, 0, result);
    result.delete(node);
    return result;
  }

  getDirectDependencies(node: string): DependencyEdge[] {
    return this.outgoing.get(node) ?? [];
  }

  getDirectDependents(node: string): DependencyEdge[] {
    return this.incoming.get(node) ?? [];
  }

  getConnectedSubgraph(nodes: string[], depth: number = 1): Set<string> {
    const result = new Set<string>();
    for (const node of nodes) {
      result.add(node);
      for (const dep of this.getDependencies(node, depth)) {
        result.add(dep);
      }
      for (const dep of this.getDependents(node, depth)) {
        result.add(dep);
      }
    }
    return result;
  }

  getShortestPath(from: string, to: string): string[] | undefined {
    if (from === to) return [from];

    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[] }> = [{ node: from, path: [from] }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      if (current.node === to) return current.path;
      if (visited.has(current.node)) continue;

      visited.add(current.node);

      const deps = this.outgoing.get(current.node) ?? [];
      for (const dep of deps) {
        if (!visited.has(dep.target)) {
          queue.push({ node: dep.target, path: [...current.path, dep.target] });
        }
      }
    }

    return undefined;
  }

  getDistance(from: string, to: string): number {
    const path = this.getShortestPath(from, to);
    return path ? path.length - 1 : Infinity;
  }

  getAllNodes(): Set<string> {
    return new Set(this.nodes);
  }

  getEdgeCount(): number {
    let count = 0;
    for (const edges of this.outgoing.values()) {
      count += edges.length;
    }
    return count;
  }

  hasNode(node: string): boolean {
    return this.nodes.has(node);
  }

  clear(): void {
    this.outgoing.clear();
    this.incoming.clear();
    this.nodes.clear();
  }

  private traverseOutgoing(
    node: string,
    maxDepth: number,
    currentDepth: number,
    visited: Set<string>,
  ): void {
    if (currentDepth > maxDepth || visited.has(node)) return;
    visited.add(node);

    const edges = this.outgoing.get(node) ?? [];
    for (const edge of edges) {
      this.traverseOutgoing(edge.target, maxDepth, currentDepth + 1, visited);
    }
  }

  private traverseIncoming(
    node: string,
    maxDepth: number,
    currentDepth: number,
    visited: Set<string>,
  ): void {
    if (currentDepth > maxDepth || visited.has(node)) return;
    visited.add(node);

    const edges = this.incoming.get(node) ?? [];
    for (const edge of edges) {
      this.traverseIncoming(edge.source, maxDepth, currentDepth + 1, visited);
    }
  }

  detectCommunities(iterations: number = 10): Map<string, number> {
    const nodes = Array.from(this.nodes);
    const communityMap = new Map<string, number>();

    nodes.forEach((node, idx) => {
      communityMap.set(node, idx);
    });

    for (let iter = 0; iter < iterations; iter++) {
      let changed = false;

      for (const node of nodes) {
        const neighborCommunities = new Map<number, number>();

        const outEdges = this.outgoing.get(node) ?? [];
        for (const edge of outEdges) {
          const c = communityMap.get(edge.target);
          if (c !== undefined) {
            neighborCommunities.set(c, (neighborCommunities.get(c) ?? 0) + (edge.weight || 1));
          }
        }

        const inEdges = this.incoming.get(node) ?? [];
        for (const edge of inEdges) {
          const c = communityMap.get(edge.source);
          if (c !== undefined) {
            neighborCommunities.set(c, (neighborCommunities.get(c) ?? 0) + (edge.weight || 1));
          }
        }

        if (neighborCommunities.size > 0) {
          let maxWeight = -1;
          let bestCommunity = communityMap.get(node)!;

          for (const [c, weight] of neighborCommunities.entries()) {
            if (weight > maxWeight || (weight === maxWeight && c < bestCommunity)) {
              maxWeight = weight;
              bestCommunity = c;
            }
          }

          if (bestCommunity !== communityMap.get(node)) {
            communityMap.set(node, bestCommunity);
            changed = true;
          }
        }
      }

      if (!changed) break;
    }

    const uniqueIds = Array.from(new Set(communityMap.values())).sort((a, b) => a - b);
    const idMap = new Map<number, number>();
    uniqueIds.forEach((id, idx) => idMap.set(id, idx));

    const finalMap = new Map<string, number>();
    for (const [node, id] of communityMap.entries()) {
      finalMap.set(node, idMap.get(id) ?? 0);
    }

    return finalMap;
  }
}

export interface CommunityCluster {
  id: number;
  name: string;
  nodes: string[];
  size: number;
}

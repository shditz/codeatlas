import type { DependencyEdge } from '@codeatlas-ai/core';

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

  getBlastRadius(
    changedFiles: string[],
    maxDepth: number = 5,
  ): {
    directlyAffected: string[];
    transitivelyAffected: string[];
    affectedByFile: Map<string, string[]>;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  } {
    const directSet = new Set<string>();
    const transitiveSet = new Set<string>();
    const affectedByFile = new Map<string, string[]>();

    for (const changedFile of changedFiles) {
      const affected: string[] = [];

      const directDeps = this.incoming.get(changedFile) ?? [];
      for (const edge of directDeps) {
        directSet.add(edge.source);
        affected.push(edge.source);
      }

      const visited = new Set<string>([changedFile]);
      const queue = directDeps.map((e) => ({ node: e.source, depth: 1 }));

      while (queue.length > 0) {
        const item = queue.shift();
        if (!item || item.depth >= maxDepth) continue;
        if (visited.has(item.node)) continue;
        visited.add(item.node);

        const nextDeps = this.incoming.get(item.node) ?? [];
        for (const edge of nextDeps) {
          if (!visited.has(edge.source)) {
            transitiveSet.add(edge.source);
            affected.push(edge.source);
            queue.push({ node: edge.source, depth: item.depth + 1 });
          }
        }
      }

      affectedByFile.set(changedFile, [...new Set(affected)]);
    }

    for (const f of directSet) {
      transitiveSet.delete(f);
    }
    for (const f of changedFiles) {
      directSet.delete(f);
      transitiveSet.delete(f);
    }

    let maxInDegree = 0;
    for (const f of changedFiles) {
      maxInDegree = Math.max(maxInDegree, this.incoming.get(f)?.length ?? 0);
    }

    let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (maxInDegree >= 10 || directSet.size >= 10) {
      severity = 'CRITICAL';
    } else if (maxInDegree >= 5 || directSet.size >= 5) {
      severity = 'HIGH';
    } else if (directSet.size > 0 || transitiveSet.size > 0) {
      severity = 'MEDIUM';
    }

    return {
      directlyAffected: [...directSet],
      transitivelyAffected: [...transitiveSet],
      affectedByFile,
      severity,
    };
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

  computePageRank(damping: number = 0.85, iterations: number = 20): Map<string, number> {
    const nodes = Array.from(this.nodes);
    const n = nodes.length;
    if (n === 0) return new Map();

    let scores = new Map<string, number>();
    const initialScore = 1 / n;
    for (const node of nodes) {
      scores.set(node, initialScore);
    }

    for (let iter = 0; iter < iterations; iter++) {
      const nextScores = new Map<string, number>();
      const baseScore = (1 - damping) / n;

      for (const node of nodes) {
        nextScores.set(node, baseScore);
      }

      for (const node of nodes) {
        const currentScore = scores.get(node) ?? 0;
        const outEdges = this.outgoing.get(node) ?? [];
        if (outEdges.length > 0) {
          const share = (damping * currentScore) / outEdges.length;
          for (const edge of outEdges) {
            nextScores.set(edge.target, (nextScores.get(edge.target) ?? 0) + share);
          }
        } else {
          const share = (damping * currentScore) / n;
          for (const target of nodes) {
            nextScores.set(target, (nextScores.get(target) ?? 0) + share);
          }
        }
      }

      scores = nextScores;
    }

    return scores;
  }

  getPageRank(node: string): number | undefined {
    if (!this.nodes.has(node)) return undefined;
    const pageRanks = this.computePageRank();
    return pageRanks.get(node);
  }

  findExecutionPath(from: string, to: string): ExecutionPath | undefined {
    const rawPath = this.getShortestPath(from, to);
    if (!rawPath || rawPath.length === 0) return undefined;

    const steps: ExecutionStep[] = [];
    let totalConfidence = 1.0;

    for (let i = 0; i < rawPath.length - 1; i++) {
      const src = rawPath[i]!;
      const tgt = rawPath[i + 1]!;
      const edges = this.outgoing.get(src) ?? [];
      const edge = edges.find((e) => e.target === tgt) ?? {
        source: src,
        target: tgt,
        kind: 'import',
        symbols: [],
        weight: 1.0,
        confidence: 0.9,
        resolution: 'heuristic',
      };

      const stepConfidence = edge.confidence ?? 0.9;
      totalConfidence *= stepConfidence;

      steps.push({
        from: src,
        to: tgt,
        kind: edge.kind,
        confidence: stepConfidence,
        resolution: edge.resolution ?? 'tree-sitter',
        symbols: edge.symbols,
      });
    }

    return {
      nodes: rawPath,
      steps,
      totalConfidence: Math.round(totalConfidence * 100) / 100,
    };
  }

  findEntryPoints(targetNode: string, maxDepth: number = 10): EntryPointInfo[] {
    if (!this.nodes.has(targetNode)) return [];

    const entryPoints: EntryPointInfo[] = [];
    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[]; depth: number }> = [
      { node: targetNode, path: [targetNode], depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || current.depth >= maxDepth) continue;

      if (visited.has(current.node)) continue;
      visited.add(current.node);

      const incomingEdges = this.incoming.get(current.node) ?? [];
      if (incomingEdges.length === 0 && current.node !== targetNode) {
        entryPoints.push({
          entryPoint: current.node,
          isRoot: true,
          distance: current.depth,
          callChain: [...current.path].reverse(),
        });
      } else {
        const isIngressPattern =
          current.node !== targetNode &&
          /(index|main|app|server|cli|command|route|controller)\.(ts|js|py|go|rs)$/i.test(
            current.node,
          );

        if (isIngressPattern) {
          entryPoints.push({
            entryPoint: current.node,
            isRoot: incomingEdges.length === 0,
            distance: current.depth,
            callChain: [...current.path].reverse(),
          });
        }

        for (const edge of incomingEdges) {
          if (!visited.has(edge.source)) {
            queue.push({
              node: edge.source,
              path: [...current.path, edge.source],
              depth: current.depth + 1,
            });
          }
        }
      }
    }

    return entryPoints.sort((a, b) => a.distance - b.distance);
  }
  calculateChangeSurface(filePaths: string[], maxDepth: number = 5): ChangeSurfaceResult {
    const blast = this.getBlastRadius(filePaths, maxDepth);
    const affectedCount = blast.directlyAffected.length + blast.transitivelyAffected.length;

    let riskScore =
      ((blast.directlyAffected.length * 2.0 + blast.transitivelyAffected.length * 1.0) /
        Math.max(1, this.nodes.size)) *
      100;
    riskScore = Math.min(100, Math.round(riskScore * 10) / 10);

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (riskScore > 50 || blast.directlyAffected.length > 20) {
      riskLevel = 'CRITICAL';
    } else if (riskScore > 25 || blast.directlyAffected.length > 10) {
      riskLevel = 'HIGH';
    } else if (riskScore > 10 || blast.directlyAffected.length > 3) {
      riskLevel = 'MEDIUM';
    }

    const allAffected = [...blast.directlyAffected, ...blast.transitivelyAffected];
    const recommendedTestFiles = allAffected.filter((f) => /(test|spec|__tests__)/i.test(f));

    return {
      targetFiles: filePaths,
      directlyAffected: blast.directlyAffected,
      transitivelyAffected: blast.transitivelyAffected,
      affectedCount,
      riskScore,
      riskLevel,
      recommendedTestFiles,
    };
  }
}

export interface ExecutionStep {
  from: string;
  to: string;
  kind: string;
  confidence: number;
  resolution: string;
  symbols: string[];
}

export interface ExecutionPath {
  nodes: string[];
  steps: ExecutionStep[];
  totalConfidence: number;
}

export interface EntryPointInfo {
  entryPoint: string;
  isRoot: boolean;
  distance: number;
  callChain: string[];
}

export interface ChangeSurfaceResult {
  targetFiles: string[];
  directlyAffected: string[];
  transitivelyAffected: string[];
  affectedCount: number;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendedTestFiles: string[];
}

export interface CommunityCluster {
  id: number;
  name: string;
  nodes: string[];
  size: number;
}

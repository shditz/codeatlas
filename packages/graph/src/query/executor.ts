import type { DependencyGraph } from '../dependency-graph.js';
import { Parser } from './parser.js';
import type {
  GraphQuery,
  GraphQueryResult,
  GraphNodeItem,
  GraphEdgeItem,
  WhereClause,
} from './types.js';

export class GraphQueryEngine {
  private graph: DependencyGraph;
  private nodesMap = new Map<string, GraphNodeItem>();
  private edgesList: GraphEdgeItem[] = [];

  constructor(graph: DependencyGraph, nodes?: GraphNodeItem[], edges?: GraphEdgeItem[]) {
    this.graph = graph;

    if (nodes) {
      for (const node of nodes) {
        this.nodesMap.set(node.id, node);
      }
    } else {
      for (const id of this.graph.getAllNodes()) {
        this.nodesMap.set(id, {
          id,
          label: id.includes(':') ? 'Symbol' : 'File',
          properties: {
            name: id.split('/').pop() || id,
            path: id,
          },
        });
      }
    }

    if (edges) {
      this.edgesList = edges;
    }
  }

  /**
   * Execute a Cypher-like string query against the graph.
   */
  execute(queryString: string): GraphQueryResult {
    const startTime = Date.now();
    const parser = new Parser(queryString);
    const query = parser.parse();

    const rows = this.executeQuery(query);
    const executionTimeMs = Date.now() - startTime;

    return {
      columns: query.returnVariables,
      rows,
      count: rows.length,
      executionTimeMs,
    };
  }

  private executeQuery(query: GraphQuery): Array<Record<string, unknown>> {
    const results: Array<Record<string, unknown>> = [];

    // Filter candidate source nodes
    const candidateSources = this.findMatchingNodes(query.source);

    for (const sourceNode of candidateSources) {
      if (!query.edge || !query.target) {
        // Single node query: MATCH (n) WHERE ... RETURN n
        const binding: Record<string, unknown> = {
          [query.source.variable]: sourceNode,
        };

        if (this.evaluateWhereClauses(binding, query.whereClauses)) {
          results.push(this.projectRow(binding, query.returnVariables));
        }
        continue;
      }

      // Edge traversal query: MATCH (s)-[e]->(t)
      const connectedEdges = this.findMatchingEdges(sourceNode.id, query.edge);

      for (const edge of connectedEdges) {
        const targetId = query.edge.direction === 'incoming' ? edge.source : edge.target;
        const targetNode = this.nodesMap.get(targetId);

        if (!targetNode || !this.matchesNodePattern(targetNode, query.target)) {
          continue;
        }

        const binding: Record<string, unknown> = {
          [query.source.variable]: sourceNode,
          [query.target.variable]: targetNode,
        };

        if (query.edge.variable) {
          binding[query.edge.variable] = edge;
        }

        if (this.evaluateWhereClauses(binding, query.whereClauses)) {
          results.push(this.projectRow(binding, query.returnVariables));
        }
      }
    }

    return results;
  }

  private findMatchingNodes(pattern: {
    label?: string;
    properties?: Record<string, unknown>;
  }): GraphNodeItem[] {
    const matched: GraphNodeItem[] = [];

    for (const node of this.nodesMap.values()) {
      if (this.matchesNodePattern(node, pattern)) {
        matched.push(node);
      }
    }

    return matched;
  }

  private matchesNodePattern(
    node: GraphNodeItem,
    pattern: { label?: string; properties?: Record<string, unknown> },
  ): boolean {
    if (pattern.label && pattern.label.toLowerCase() !== node.label.toLowerCase()) {
      return false;
    }

    if (pattern.properties) {
      for (const [key, val] of Object.entries(pattern.properties)) {
        if (node.properties[key] !== val && node.id !== val) {
          return false;
        }
      }
    }

    return true;
  }

  private findMatchingEdges(
    nodeId: string,
    edgePattern: { type?: string; direction: 'outgoing' | 'incoming' | 'both' },
  ): GraphEdgeItem[] {
    let candidateEdges: GraphEdgeItem[] = [];

    if (this.edgesList.length > 0) {
      candidateEdges = this.edgesList.filter((e) => {
        if (edgePattern.direction === 'outgoing') return e.source === nodeId;
        if (edgePattern.direction === 'incoming') return e.target === nodeId;
        return e.source === nodeId || e.target === nodeId;
      });
    } else {
      // Build from DependencyGraph direct methods
      if (edgePattern.direction === 'outgoing' || edgePattern.direction === 'both') {
        const outDeps = this.graph.getDirectDependencies(nodeId);
        candidateEdges.push(
          ...outDeps.map((d) => ({
            source: d.source,
            target: d.target,
            type: d.kind.toUpperCase(),
            properties: { weight: d.weight, symbols: d.symbols },
          })),
        );
      }
      if (edgePattern.direction === 'incoming' || edgePattern.direction === 'both') {
        const inDeps = this.graph.getDirectDependents(nodeId);
        candidateEdges.push(
          ...inDeps.map((d) => ({
            source: d.source,
            target: d.target,
            type: d.kind.toUpperCase(),
            properties: { weight: d.weight, symbols: d.symbols },
          })),
        );
      }
    }

    if (edgePattern.type) {
      const typeUpper = edgePattern.type.toUpperCase();
      candidateEdges = candidateEdges.filter((e) => e.type.toUpperCase() === typeUpper);
    }

    return candidateEdges;
  }

  private evaluateWhereClauses(binding: Record<string, unknown>, whereClauses: WhereClause[]): boolean {
    for (const clause of whereClauses) {
      const entity = binding[clause.variable] as
        | { properties?: Record<string, unknown>; [key: string]: unknown }
        | undefined;
      if (!entity) return false;

      const entityProps = (entity.properties ?? entity) as Record<string, unknown>;
      const actualVal = entityProps[clause.property] ?? entity[clause.property];

      if (actualVal === undefined) return false;

      const passed = this.compare(actualVal, clause.operator, clause.value);
      if (!passed) return false;
    }
    return true;
  }

  private compare(actual: unknown, operator: string, expected: unknown): boolean {
    const actStr = String(actual).toLowerCase();
    const expStr = String(expected).toLowerCase();

    switch (operator) {
      case '=':
        return typeof actual === 'number' ? actual === Number(expected) : actStr === expStr;
      case '!=':
        return typeof actual === 'number' ? actual !== Number(expected) : actStr !== expStr;
      case 'CONTAINS':
        return actStr.includes(expStr);
      case 'STARTS_WITH':
        return actStr.startsWith(expStr);
      case 'ENDS_WITH':
        return actStr.endsWith(expStr);
      case '>':
        return Number(actual) > Number(expected);
      case '<':
        return Number(actual) < Number(expected);
      case '>=':
        return Number(actual) >= Number(expected);
      case '<=':
        return Number(actual) <= Number(expected);
      default:
        return false;
    }
  }

  private projectRow(binding: Record<string, unknown>, returnVariables: string[]): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const varName of returnVariables) {
      const parts = varName.split('.');
      const rootVar = parts[0]!;
      const entity = binding[rootVar] as
        | { properties?: Record<string, unknown>; [key: string]: unknown }
        | undefined;

      if (!entity) {
        row[varName] = null;
        continue;
      }

      if (parts.length > 1) {
        const prop = parts[1]!;
        const entityProps = (entity.properties ?? entity) as Record<string, unknown>;
        row[varName] = entityProps[prop] ?? null;
      } else {
        row[varName] = entity.properties ?? entity;
      }
    }
    return row;
  }
}

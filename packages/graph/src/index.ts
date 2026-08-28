export { DependencyGraph, type CommunityCluster } from './dependency-graph.js';
export { Lexer } from './query/lexer.js';
export { Parser } from './query/parser.js';
export { GraphQueryEngine } from './query/executor.js';
export type {
  Token,
  TokenType,
  GraphQuery,
  NodePattern,
  EdgePattern,
  WhereClause,
  ComparisonOperator,
  GraphNodeItem,
  GraphEdgeItem,
  GraphQueryResult,
} from './query/types.js';

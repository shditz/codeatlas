export type TokenType =
  | 'KEYWORD'
  | 'IDENTIFIER'
  | 'STRING'
  | 'NUMBER'
  | 'COLON'
  | 'COMMA'
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'LBRACE'
  | 'RBRACE'
  | 'ARROW_RIGHT'
  | 'ARROW_LEFT'
  | 'DASH'
  | 'OPERATOR'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export interface NodePattern {
  variable: string;
  label?: string; 
  properties?: Record<string, string | number | boolean>;
}

export interface EdgePattern {
  variable?: string;
  type?: string; 
  direction: 'outgoing' | 'incoming' | 'both';
}

export type ComparisonOperator =
  '=' | '!=' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | '>' | '<' | '>=' | '<=';

export interface WhereClause {
  variable: string;
  property: string;
  operator: ComparisonOperator;
  value: string | number | boolean;
}

export interface GraphQuery {
  source: NodePattern;
  edge?: EdgePattern;
  target?: NodePattern;
  whereClauses: WhereClause[];
  returnVariables: string[];
}

export interface GraphNodeItem {
  id: string;
  label: string;
  properties: Record<string, unknown>;
}

export interface GraphEdgeItem {
  source: string;
  target: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface GraphQueryResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  count: number;
  executionTimeMs: number;
}

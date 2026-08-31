import type { DependencyKind, Language } from '@codeatlas-ai/core';

export type SemanticRelationKind =
  | DependencyKind
  | 'type-reference'
  | 'call'
  | 'instantiates';

export interface SemanticEdge {
  sourceFile: string;
  targetFile: string;
  kind: DependencyKind;
  symbols: string[];
  weight: number;
  confidence: number;
  resolution: string;
  detail?: string;
}

export interface SemanticSymbol {
  name: string;
  filePath: string;
  line: number;
  column: number;
  kind: string;
  typeSignature?: string;
  documentation?: string;
}

export interface SemanticProjectResult {
  edges: SemanticEdge[];
  resolvedAliases: Map<string, string>;
  heritageHierarchy: Map<string, { extends?: string[]; implements?: string[] }>;
}

export interface SemanticResolverOptions {
  rootDir: string;
  tsConfigPath?: string;
}

export interface SemanticResolver {
  canResolve(language: Language): boolean;
  resolveProject(
    filePaths: string[],
    options: SemanticResolverOptions,
  ): Promise<SemanticProjectResult>;
}

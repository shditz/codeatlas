export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'csharp'
  | 'cpp'
  | 'c'
  | 'ruby'
  | 'kotlin'
  | 'swift'
  | 'php'
  | 'prisma'
  | 'json'
  | 'yaml'
  | 'toml'
  | 'markdown'
  | 'html'
  | 'css'
  | 'scss'
  | 'sql'
  | 'shell'
  | 'dockerfile'
  | 'unknown'
  | (string & {});

export type SymbolKind =
  | 'class'
  | 'function'
  | 'method'
  | 'interface'
  | 'type'
  | 'enum'
  | 'struct'
  | 'trait'
  | 'variable'
  | 'constant'
  | 'property'
  | 'export'
  | 'hook'
  | 'route_handler'
  | 'page'
  | 'layout'
  | 'controller'
  | 'provider'
  | 'module'
  | 'model';

export type DependencyKind = 'import' | 'export' | 'extends' | 'implements' | 'reference';

export type ContextMode = 'full' | 'signature' | 'summary' | 'digest';

export type RuleSource =
  | 'agents.md'
  | 'claude.md'
  | 'gemini.md'
  | 'cursor'
  | 'copilot'
  | 'atlas'
  | 'custom'
  | 'trae'
  | 'deepseek'
  | 'qwen'
  | 'lingma'
  | 'comate'
  | 'codegeex'
  | 'kimi'
  | 'grok'
  | 'replit'
  | 'devin'
  | 'opencode'
  | 'vellum'
  | 'openhands'
  | 'continue'
  | 'roo'
  | 'augment'
  | 'amazonq';

export type ExportTarget =
  | 'markdown'
  | 'claude'
  | 'cursor'
  | 'copilot'
  | 'gemini'
  | 'agents'
  | 'antigravity'
  | 'codex'
  | 'aider'
  | 'windsurf'
  | 'cline'
  | 'trae'
  | 'deepseek'
  | 'qwen'
  | 'lingma'
  | 'comate'
  | 'codegeex'
  | 'kimi'
  | 'grok'
  | 'replit'
  | 'devin'
  | 'opencode'
  | 'vellum'
  | 'openhands'
  | 'continue'
  | 'roo'
  | 'augment'
  | 'amazonq';

export type RuleScope = 'global' | 'path' | 'file';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

export type Framework =
  | 'next'
  | 'react'
  | 'vue'
  | 'svelte'
  | 'angular'
  | 'express'
  | 'fastify'
  | 'nestjs'
  | 'django'
  | 'flask'
  | 'spring'
  | 'unknown';

export interface ProjectMeta {
  name: string;
  root: string;
  languages: Language[];
  frameworks: Framework[];
  packageManager: PackageManager;
  fileCount: number;
  symbolCount: number;
  dependencyCount: number;
  isMonorepo: boolean;
  workspaces: string[];
}

export interface FileInfo {
  id?: number;
  path: string;
  relativePath: string;
  extension: string;
  language: Language;
  size: number;
  hash: string;
  module: string;
  isTest: boolean;
  isGenerated: boolean;
  symbolCount: number;
  importCount: number;
  exportCount: number;
  lastModified?: number;
}

export interface SymbolInfo {
  id?: number;
  name: string;
  kind: SymbolKind;
  filePath: string;
  line: number;
  endLine?: number;
  column: number;
  exported: boolean;
  signature?: string;
  parentSymbol?: string;
  cyclomaticComplexity?: number;
}

export interface ImportInfo {
  id?: number;
  filePath: string;
  importPath: string;
  resolvedPath?: string;
  symbols: string[];
  isDefault: boolean;
  isNamespace: boolean;
  isType: boolean;
  confidence?: number;
  resolution?: string;
}

export interface DependencyEdge {
  source: string;
  target: string;
  kind: DependencyKind;
  symbols: string[];
  weight: number;
  confidence?: number;
  resolution?: string;
}

export interface Rule {
  id: string;
  source: RuleSource;
  scope: RuleScope;
  filePath: string;
  content: string;
  priority: number;
  pathPattern?: string;
  agentTarget?: string;
}

export interface RuleConflict {
  ruleA: Rule;
  ruleB: Rule;
  reason: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface ScoreExplanation {
  signal: string;
  score: number;
  weight: number;
  reason: string;
}

export type RetrievalIntent = 'bug' | 'feature' | 'refactor' | 'explore';

export interface RetrievalOptions {
  limit?: number;
  intent?: RetrievalIntent;
}

export interface GitMetric {
  id?: number;
  projectId: number;
  filePath: string;
  churnCount: number;
  lastModified?: string;
  primaryOwner?: string;
  authorsJson?: string;
}

export interface RetrievalSource {
  type: 'keyword' | 'symbol' | 'path' | 'graph' | 'git';
  score: number;
  detail: string;
}

export interface RetrievalCandidate {
  filePath: string;
  file?: FileInfo;
  sources: RetrievalSource[];
  ftsRank?: number;
}

export interface ContextFile {
  path: string;
  relativePath: string;
  language: Language;
  relevance: number;
  mode: ContextMode;
  content: string;
  tokenCount: number;
  reasons: ScoreExplanation[];
}

export interface ContextPack {
  task: string;
  timestamp: string;
  repository: ProjectMeta;
  architecture?: string;
  repositoryMap?: string;
  rules: Rule[];
  files: ContextFile[];
  tokenBudget: number;
  tokenUsage: number;
  tokenBreakdown: {
    architecture: number;
    rules: number;
    repositoryMap: number;
    code: number;
  };
  retrievalStats: {
    candidateCount: number;
    selectedCount: number;
    searchTimeMs: number;
    rankingTimeMs: number;
    totalTimeMs: number;
  };
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  score: number;
  message: string;
  details?: string;
}

export interface HealthReport {
  overallScore: number;
  checks: HealthCheck[];
  categories: {
    architecture: number;
    rules: number;
    coverage: number;
    freshness: number;
    consistency: number;
    tokenEfficiency: number;
  };
}

export interface ScanResult {
  project: ProjectMeta;
  detectedFiles: number;
  skippedFiles: number;
  detectedLanguages: Record<string, number>;
  detectedFrameworks: Framework[];
  detectedPackageManager: PackageManager;
  isMonorepo: boolean;
  workspaces: string[];
  hasTests: boolean;
  hasDocs: boolean;
  hasCI: boolean;
  duration: number;
  files: FileInfo[];
}

export interface IndexState {
  lastIndexed: number;
  fileCount: number;
  symbolCount: number;
  importCount: number;
  version: string;
  hash: string;
}

export interface CycleDetectionResult {
  cycles: string[][];
  cycleCount: number;
}

export interface DeadCodeItem {
  id: string;
  name: string;
  kind: 'file' | 'symbol';
  filePath: string;
  line?: number;
  reason: string;
}

export interface NodeMetrics {
  id: string;
  name: string;
  inDegree: number;
  outDegree: number;
  instability: number;
  isGodObject: boolean;
  isLeaf: boolean;
  isRoot: boolean;
}

export interface TechnicalDebtHotspot {
  filePath: string;
  churnScore: number;
  instability: number;
  inDegree: number;
  outDegree: number;
  hotspotScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

export type ArchitectureLayerType =
  'presentation' | 'application' | 'domain' | 'infrastructure' | 'shared' | 'custom';

export interface ArchitectureLayer {
  name: string;
  patterns: string[];
  type?: ArchitectureLayerType;
  files?: string[];
}

export interface BoundedContext {
  name: string;
  patterns: string[];
  files: string[];
  publicApiFiles?: string[];
}

export interface ArchitectureViolation {
  id: string;
  sourceFile: string;
  targetFile: string;
  sourceLayer?: string;
  targetLayer?: string;
  sourceContext?: string;
  targetContext?: string;
  violationType:
    'LAYER_REGRESSION' | 'BOUNDED_CONTEXT_LEAK' | 'PUBLIC_API_BYPASS' | 'CUSTOM_RULE_VIOLATION';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  rule: string;
  description: string;
  remediation: string;
  importedSymbols?: string[];
  line?: number;
}

export interface ArchitectureReport {
  architectureType: string;
  layers: ArchitectureLayer[];
  boundedContexts: BoundedContext[];
  violations: ArchitectureViolation[];
  summary: {
    totalViolations: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    cleanScore: number;
  };
}

export interface CodebaseAnalytics {
  summary: {
    totalFiles: number;
    totalSymbols: number;
    totalEdges: number;
    graphDensity: number;
    averageDegree: number;
  };
  cycles: string[][];
  deadCode: DeadCodeItem[];
  hotspots: NodeMetrics[];
  instabilities: NodeMetrics[];
  gitHotspots?: TechnicalDebtHotspot[];
  architectureReport?: ArchitectureReport;
}

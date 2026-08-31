export interface BenchmarkTask {
  id: string;
  query: string;
  description: string;
  expectedFiles: string[]; // Relative paths that are truly relevant
}

export interface BenchmarkDataset {
  name: string;
  repositoryUrl: string;
  branch: string;
  tasks: BenchmarkTask[];
}

export interface TaskResult {
  taskId: string;
  query: string;
  retrievedFiles: string[];
  expectedFiles: string[];
  precision: number;
  recall: number;
  rawTokens: number;
  atlasTokens: number;
  tokenSavingsPct: number;
  durationMs: number;
}

export interface BenchmarkReport {
  datasetName: string;
  timestamp: string;
  taskResults: TaskResult[];
  overallPrecision: number;
  overallRecall: number;
  overallTokenSavingsPct: number;
  averageLatencyMs: number;
}

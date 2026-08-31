import { DependencyGraph } from '@codeatlas-ai/graph';
import type { AtlasDatabase } from '@codeatlas-ai/storage';
import {
  FileRepository,
  SymbolRepository,
  DependencyRepository,
  ProjectRepository,
} from '@codeatlas-ai/storage';
import type {
  CodebaseAnalytics,
  CycleDetectionResult,
  DeadCodeItem,
  NodeMetrics,
  TechnicalDebtHotspot,
} from '@codeatlas-ai/core';
import { CycleDetector } from './cycle-detector.js';
import { DeadCodeDetector, type DeadCodeDetectorOptions } from './dead-code-detector.js';
import { MetricsCalculator, type GraphMetricsSummary } from './metrics.js';
import { GitMetricsAnalyzer } from './git-metrics.js';

export class CodebaseAnalyzer {
  private graph: DependencyGraph;
  private db?: AtlasDatabase;
  private projectId: number;
  private rootDir?: string;

  constructor(options: {
    graph?: DependencyGraph;
    db?: AtlasDatabase;
    projectId?: number;
    rootDir?: string;
  }) {
    this.db = options.db;
    this.projectId = options.projectId ?? 1;
    this.rootDir = options.rootDir;

    if (options.graph) {
      this.graph = options.graph;
    } else if (this.db) {
      this.graph = new DependencyGraph();
      this.loadGraphFromDb();
    } else {
      this.graph = new DependencyGraph();
    }
  }

  private loadGraphFromDb(): void {
    if (!this.db) return;
    const depRepo = new DependencyRepository(this.db);
    const edges = depRepo.getAll(this.projectId);
    this.graph.addEdges(edges);
  }

  analyze(options?: DeadCodeDetectorOptions): CodebaseAnalytics {
    let files: ReturnType<FileRepository['getAll']> = [];
    let symbols: ReturnType<SymbolRepository['getAllByProject']> = [];
    let symbolCount = 0;

    if (this.db) {
      const fileRepo = new FileRepository(this.db);
      const symbolRepo = new SymbolRepository(this.db);
      files = fileRepo.getAll(this.projectId);
      symbols = symbolRepo.getAllByProject(this.projectId);
      symbolCount = symbolRepo.countByProject(this.projectId);
    }

    const cycleDetector = new CycleDetector(this.graph);
    const cycleRes = cycleDetector.detectCycles();

    const deadCodeDetector = new DeadCodeDetector(this.graph, files, symbols, options);
    const deadCode = deadCodeDetector.detectDeadCode();

    const metricsCalculator = new MetricsCalculator(
      this.graph,
      files.length || this.graph.getAllNodes().size,
      symbolCount,
    );
    const summary = metricsCalculator.calculateSummary();
    const hotspots = metricsCalculator.getHotspots(10);
    const instabilities = metricsCalculator.getHighInstabilities(10);

    let gitHotspots: TechnicalDebtHotspot[] | undefined;
    const projectRoot =
      this.rootDir ||
      (this.db ? new ProjectRepository(this.db).getById(this.projectId)?.root : undefined) ||
      process.cwd();

    if (projectRoot) {
      try {
        const gitAnalyzer = new GitMetricsAnalyzer(projectRoot);
        if (gitAnalyzer.isGitAvailable()) {
          gitHotspots = gitAnalyzer.analyzeHotspots(hotspots);
        }
      } catch {
        // Fallback gracefully if git history is unavailable
      }
    }

    return {
      summary,
      cycles: cycleRes.cycles,
      deadCode,
      hotspots,
      instabilities,
      gitHotspots,
    };
  }

  detectCycles(): CycleDetectionResult {
    return new CycleDetector(this.graph).detectCycles();
  }

  detectDeadCode(options?: DeadCodeDetectorOptions): DeadCodeItem[] {
    let files: ReturnType<FileRepository['getAll']> = [];
    let symbols: ReturnType<SymbolRepository['getAllByProject']> = [];
    if (this.db) {
      const fileRepo = new FileRepository(this.db);
      const symbolRepo = new SymbolRepository(this.db);
      files = fileRepo.getAll(this.projectId);
      symbols = symbolRepo.getAllByProject(this.projectId);
    }
    return new DeadCodeDetector(this.graph, files, symbols, options).detectDeadCode();
  }

  getMetricsSummary(): GraphMetricsSummary {
    return new MetricsCalculator(this.graph).calculateSummary();
  }

  getHotspots(limit: number = 10): NodeMetrics[] {
    return new MetricsCalculator(this.graph).getHotspots(limit);
  }
}

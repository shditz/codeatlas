import { DependencyGraph } from '@codeatlas/graph';
import type { AtlasDatabase } from '@codeatlas/storage';
import { FileRepository, SymbolRepository, DependencyRepository } from '@codeatlas/storage';
import type {
  CodebaseAnalytics,
  CycleDetectionResult,
  DeadCodeItem,
  NodeMetrics,
} from '@codeatlas/core';
import { CycleDetector } from './cycle-detector.js';
import { DeadCodeDetector, type DeadCodeDetectorOptions } from './dead-code-detector.js';
import { MetricsCalculator, type GraphMetricsSummary } from './metrics.js';

export class CodebaseAnalyzer {
  private graph: DependencyGraph;
  private db?: AtlasDatabase;
  private projectId: number;

  constructor(options: { graph?: DependencyGraph; db?: AtlasDatabase; projectId?: number }) {
    this.db = options.db;
    this.projectId = options.projectId ?? 1;

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
    let symbolCount = 0;

    if (this.db) {
      const fileRepo = new FileRepository(this.db);
      const symbolRepo = new SymbolRepository(this.db);
      files = fileRepo.getAll(this.projectId);
      symbolCount = symbolRepo.countByProject(this.projectId);
    }

    const cycleDetector = new CycleDetector(this.graph);
    const cycleRes = cycleDetector.detectCycles();

    const deadCodeDetector = new DeadCodeDetector(this.graph, files, [], options);
    const deadCode = deadCodeDetector.detectDeadCode();

    const metricsCalculator = new MetricsCalculator(
      this.graph,
      files.length || this.graph.getAllNodes().size,
      symbolCount,
    );
    const summary = metricsCalculator.calculateSummary();
    const hotspots = metricsCalculator.getHotspots(10);
    const instabilities = metricsCalculator.getHighInstabilities(10);

    return {
      summary,
      cycles: cycleRes.cycles,
      deadCode,
      hotspots,
      instabilities,
    };
  }

  detectCycles(): CycleDetectionResult {
    return new CycleDetector(this.graph).detectCycles();
  }

  detectDeadCode(options?: DeadCodeDetectorOptions): DeadCodeItem[] {
    let files: ReturnType<FileRepository['getAll']> = [];
    if (this.db) {
      const fileRepo = new FileRepository(this.db);
      files = fileRepo.getAll(this.projectId);
    }
    return new DeadCodeDetector(this.graph, files, [], options).detectDeadCode();
  }

  getMetricsSummary(): GraphMetricsSummary {
    return new MetricsCalculator(this.graph).calculateSummary();
  }

  getHotspots(limit: number = 10): NodeMetrics[] {
    return new MetricsCalculator(this.graph).getHotspots(limit);
  }
}

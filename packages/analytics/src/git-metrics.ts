import type { NodeMetrics } from '@codeatlas/core';
import { GitService } from '@codeatlas/git';

export interface FileChurnInfo {
  filePath: string;
  commitCount: number;
  lastModified?: string;
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

export class GitMetricsAnalyzer {
  private gitService: GitService;

  constructor(repoRoot: string) {
    this.gitService = new GitService(repoRoot);
  }

  isGitAvailable(): boolean {
    return this.gitService.isGitRepo();
  }

  calculateChurn(commitLimit: number = 100): Map<string, number> {
    const churnMap = new Map<string, number>();
    if (!this.isGitAvailable()) return churnMap;

    try {
      const changedFiles = this.gitService.getChangedFiles(`HEAD~${commitLimit}`);
      for (const file of changedFiles) {
        const count = churnMap.get(file) ?? 0;
        churnMap.set(file, count + 1);
      }
    } catch {
      // Fallback if shallow repo or fewer commits
      const recent = this.gitService.getRecentCommits(commitLimit);
      for (const commit of recent) {
        // approximate churn count from commit history
        churnMap.set(commit.hash, 1);
      }
    }

    return churnMap;
  }

  analyzeHotspots(
    nodeMetrics: NodeMetrics[],
    customChurnMap?: Map<string, number>,
  ): TechnicalDebtHotspot[] {
    const churnMap = customChurnMap ?? this.calculateChurn(50);
    const hotspots: TechnicalDebtHotspot[] = [];

    for (const node of nodeMetrics) {
      const churnCount = churnMap.get(node.id) ?? churnMap.get(node.name) ?? 0;
      
      // Hotspot formula: Churn * (1 + Instability) * (1 + ln(1 + inDegree))
      const logInDegree = Math.log(1 + node.inDegree);
      const hotspotScore = Number(
        (churnCount * (1 + node.instability * 2) * (1 + logInDegree) + node.inDegree * 0.5).toFixed(2),
      );

      let riskLevel: 'critical' | 'high' | 'medium' | 'low' = 'low';
      let recommendation = 'Low structural risk. Code is stable.';

      if (hotspotScore >= 15 || (node.isGodObject && churnCount > 3)) {
        riskLevel = 'critical';
        recommendation = 'Critical technical debt: High churn combined with high coupling/God Object status. Refactor into smaller focused modules.';
      } else if (hotspotScore >= 8 || node.instability > 0.8) {
        riskLevel = 'high';
        recommendation = 'High volatility: Frequently modified and dependent on unstable abstractions. Add unit test coverage and decouple dependencies.';
      } else if (hotspotScore >= 3 || node.inDegree > 5) {
        riskLevel = 'medium';
        recommendation = 'Moderate coupling: Ensure API stability and interface boundaries.';
      }

      hotspots.push({
        filePath: node.id,
        churnScore: churnCount,
        instability: node.instability,
        inDegree: node.inDegree,
        outDegree: node.outDegree,
        hotspotScore,
        riskLevel,
        recommendation,
      });
    }

    return hotspots.sort((a, b) => b.hotspotScore - a.hotspotScore);
  }
}

import type { FileInfo, RetrievalCandidate, RetrievalSource } from '@codeatlas-ai/core';
import type { SearchRepository } from '@codeatlas-ai/storage';
import type { DependencyGraph } from '@codeatlas-ai/graph';
import { createLogger } from '@codeatlas-ai/shared';

const logger = createLogger('retrieval');

export type { RetrievalCandidate, RetrievalSource };

export interface RetrievalResult {
  candidates: RetrievalCandidate[];
  queryTerms: string[];
  duration: number;
}

export class RetrievalEngine {
  constructor(
    private searchRepo: SearchRepository,
    private graph: DependencyGraph,
    private filesByPath: Map<string, FileInfo>,
  ) {}

  retrieve(query: string, limit: number = 50): RetrievalResult {
    const startTime = Date.now();
    const queryTerms = this.extractTerms(query);
    const candidateMap = new Map<string, RetrievalCandidate>();

    const ftsResults = this.searchRepo.searchFiles(query, limit);
    for (const result of ftsResults) {
      this.addCandidate(candidateMap, result.relativePath, {
        type: 'keyword',
        score: Math.max(1.0, 5.0 + Math.abs(result.rank ?? 0)),
        detail: `FTS match (rank: ${(result.rank ?? 0).toFixed(2)})`,
      });
    }

    try {
      const symbolMatches = this.searchRepo.searchSymbols(query, limit);
      for (const sm of symbolMatches) {
        if (sm.relativePath) {
          this.addCandidate(candidateMap, sm.relativePath, {
            type: 'symbol',
            score: 4.0,
            detail: `Symbol definition match (rank: ${(sm.rank ?? 0).toFixed(2)})`,
          });
        }
      }
    } catch {
      // Symbol FTS fallback
    }

    for (const [filePath] of this.filesByPath) {
      const pathScore = this.scorePathMatch(filePath, queryTerms);
      if (pathScore > 0) {
        this.addCandidate(candidateMap, filePath, {
          type: 'path',
          score: pathScore * 3.5,
          detail: `Path contains query terms (${Math.round(pathScore * 100)}% match)`,
        });
      }
    }

    const matchedFiles = [...candidateMap.keys()];
    for (const filePath of matchedFiles) {
      const deps = this.graph.getDependencies(filePath, 1);
      for (const dep of deps) {
        this.addCandidate(candidateMap, dep, {
          type: 'graph',
          score: 0.8,
          detail: `Dependency of ${filePath.split('/').pop()}`,
        });
      }

      const dependents = this.graph.getDependents(filePath, 1);
      for (const dep of dependents) {
        this.addCandidate(candidateMap, dep, {
          type: 'graph',
          score: 0.6,
          detail: `Dependent on ${filePath.split('/').pop()}`,
        });
      }
    }

    for (const [filePath, candidate] of candidateMap.entries()) {
      const incomingEdges = this.graph.getDirectDependents(filePath);
      if (incomingEdges.length > 0) {
        const centralityBoost = Math.min(2.5, incomingEdges.length * 0.3);
        candidate.sources.push({
          type: 'graph',
          score: centralityBoost,
          detail: `Core architectural module (depended on by ${incomingEdges.length} files)`,
        });
      }
    }

    for (const candidate of candidateMap.values()) {
      candidate.file = this.filesByPath.get(candidate.filePath);
    }

    const candidates = [...candidateMap.values()]
      .sort((a, b) => {
        const scoreA = a.sources.reduce((sum, s) => sum + s.score, 0);
        const scoreB = b.sources.reduce((sum, s) => sum + s.score, 0);
        return scoreB - scoreA;
      })
      .slice(0, limit);

    const duration = Date.now() - startTime;
    logger.debug(`Retrieved ${candidates.length} candidates in ${duration}ms`);

    return { candidates, queryTerms, duration };
  }

  private addCandidate(
    map: Map<string, RetrievalCandidate>,
    filePath: string,
    source: RetrievalSource,
  ): void {
    const existing = map.get(filePath);
    if (existing) {
      existing.sources.push(source);
    } else {
      map.set(filePath, {
        filePath,
        sources: [source],
      });
    }
  }

  private extractTerms(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 1)
      .filter((term) => !STOP_WORDS.has(term));
  }

  private scorePathMatch(filePath: string, terms: string[]): number {
    if (terms.length === 0) return 0;
    const lowerPath = filePath.toLowerCase();
    const basename = lowerPath.split('/').pop() ?? '';
    let matchCount = 0;

    for (const term of terms) {
      if (basename.includes(term)) {
        matchCount += 1.5;
      } else if (lowerPath.includes(term)) {
        matchCount += 1.0;
      }
    }

    return matchCount / terms.length;
  }
}

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'it',
  'to',
  'in',
  'on',
  'of',
  'for',
  'and',
  'or',
  'but',
  'not',
  'with',
  'this',
  'that',
  'from',
  'add',
  'fix',
  'make',
  'implement',
  'create',
  'update',
  'change',
  'new',
  'get',
  'set',
  'use',
  'do',
  'be',
  'find',
  'how',
  'where',
  'what',
  'locate',
  'which',
  'who',
  'when',
  'why',
]);

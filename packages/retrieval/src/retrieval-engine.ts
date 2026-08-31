import type {
  FileInfo,
  RetrievalCandidate,
  RetrievalSource,
  RetrievalOptions,
  RetrievalIntent,
} from '@codeatlas-ai/core';
import type { SearchRepository } from '@codeatlas-ai/storage';
import type { DependencyGraph } from '@codeatlas-ai/graph';
import { createLogger } from '@codeatlas-ai/shared';

const logger = createLogger('retrieval');

export type { RetrievalCandidate, RetrievalSource, RetrievalOptions, RetrievalIntent };

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

  retrieve(query: string, optionsOrLimit: number | RetrievalOptions = 50): RetrievalResult {
    const startTime = Date.now();
    const options: RetrievalOptions =
      typeof optionsOrLimit === 'number' ? { limit: optionsOrLimit } : (optionsOrLimit ?? {});
    const limit = options.limit ?? 50;
    const intent = options.intent;

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
          const symScore = intent === 'feature' ? 5.5 : 4.0;
          this.addCandidate(candidateMap, sm.relativePath, {
            type: 'symbol',
            score: symScore,
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
      const directDeps = this.graph.getDirectDependencies(filePath);
      for (const edge of directDeps) {
        const conf = edge.confidence ?? 0.9;
        const res = edge.resolution ? ` via ${edge.resolution}` : '';
        const depMultiplier = intent === 'feature' ? 1.4 : 0.8;
        const kindBoost = edge.kind === 'extends' || edge.kind === 'implements' ? 1.5 : 1.0;

        this.addCandidate(candidateMap, edge.target, {
          type: 'graph',
          score: depMultiplier * conf * kindBoost,
          detail: `Dependency of ${filePath.split('/').pop()} (confidence: ${Math.round(conf * 100)}%${res}${edge.kind !== 'import' ? `, kind: ${edge.kind}` : ''})`,
        });
      }

      const directDependents = this.graph.getDirectDependents(filePath);
      for (const edge of directDependents) {
        const conf = edge.confidence ?? 0.9;
        const res = edge.resolution ? ` via ${edge.resolution}` : '';
        const callerMultiplier = intent === 'bug' ? 1.6 : 0.6;

        this.addCandidate(candidateMap, edge.source, {
          type: 'graph',
          score: callerMultiplier * conf,
          detail: `Caller/Dependent ${filePath.split('/').pop()} (confidence: ${Math.round(conf * 100)}%${res})`,
        });
      }
    }

    for (const [filePath, candidate] of candidateMap.entries()) {
      candidate.file = this.filesByPath.get(filePath);

      const incomingEdges = this.graph.getDirectDependents(filePath);
      if (incomingEdges.length > 0) {
        const centralityMultiplier = intent === 'refactor' ? 0.6 : 0.3;
        const maxBoost = intent === 'refactor' ? 4.5 : 2.5;
        const centralityBoost = Math.min(maxBoost, incomingEdges.length * centralityMultiplier);
        candidate.sources.push({
          type: 'graph',
          score: centralityBoost,
          detail: `Core architectural module (depended on by ${incomingEdges.length} files${intent === 'refactor' ? ', refactor priority' : ''})`,
        });
      }

      if (intent === 'bug') {
        if (candidate.file?.isTest || filePath.includes('test') || filePath.includes('spec')) {
          candidate.sources.push({
            type: 'path',
            score: 2.5,
            detail: `Test file boosted for bug fix intent verification`,
          });
        }
      } else if (intent === 'feature') {
        if (
          filePath.includes('interface') ||
          filePath.includes('model') ||
          filePath.includes('type') ||
          filePath.includes('schema')
        ) {
          candidate.sources.push({
            type: 'symbol',
            score: 2.0,
            detail: `Domain interface/type definition boosted for feature intent`,
          });
        }
      } else if (intent === 'refactor') {
        if (filePath.includes('index') || filePath.includes('api') || filePath.includes('public')) {
          candidate.sources.push({
            type: 'path',
            score: 2.0,
            detail: `Public API boundary file boosted for refactor intent`,
          });
        }
      }
    }

    const candidates = [...candidateMap.values()]
      .sort((a, b) => {
        const scoreA = a.sources.reduce((sum, s) => sum + s.score, 0);
        const scoreB = b.sources.reduce((sum, s) => sum + s.score, 0);
        return scoreB - scoreA;
      })
      .slice(0, limit);

    const duration = Date.now() - startTime;
    logger.debug(
      `Retrieved ${candidates.length} candidates (intent: ${intent ?? 'default'}) in ${duration}ms`,
    );

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

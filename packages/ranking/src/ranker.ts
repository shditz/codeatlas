import type {
  ScoreExplanation,
  RankingConfig,
  RetrievalCandidate,
  RetrievalSource,
} from '@codeatlas-ai/core';
import { createLogger } from '@codeatlas-ai/shared';

const logger = createLogger('ranking');

export interface RankedResult {
  filePath: string;
  relevance: number;
  explanations: ScoreExplanation[];
  candidate: RetrievalCandidate;
}

export interface RankerOptions {
  weights: RankingConfig;
  queryTerms: string[];
}

export class Ranker {
  private weights: RankingConfig;
  private queryTerms: string[];

  constructor(options: RankerOptions) {
    this.weights = options.weights;
    this.queryTerms = options.queryTerms;
  }

  rank(candidates: RetrievalCandidate[]): RankedResult[] {
    const results: RankedResult[] = [];

    for (const candidate of candidates) {
      const explanations: ScoreExplanation[] = [];
      let totalScore = 0;

      const lexicalScore = this.computeLexicalScore(candidate);
      if (lexicalScore > 0) {
        totalScore += lexicalScore * this.weights.lexical_weight;
        const keywordDetails = candidate.sources
          .filter((s: RetrievalSource) => s.type === 'keyword')
          .map((s) => s.detail)
          .join('; ');
        explanations.push({
          signal: 'lexical',
          score: lexicalScore,
          weight: this.weights.lexical_weight,
          reason: keywordDetails || 'Full-text search match',
        });
      }

      const symbolScore = this.computeSymbolScore(candidate);
      if (symbolScore > 0) {
        totalScore += symbolScore * this.weights.symbol_weight;
        const symbolDetails = candidate.sources
          .filter((s: RetrievalSource) => s.type === 'symbol')
          .map((s) => s.detail)
          .join('; ');
        explanations.push({
          signal: 'symbol',
          score: symbolScore,
          weight: this.weights.symbol_weight,
          reason: symbolDetails || 'Symbol name matches query terms',
        });
      }

      const pathScore = this.computePathScore(candidate);
      if (pathScore > 0) {
        totalScore += pathScore * this.weights.path_weight;
        const pathDetails = candidate.sources
          .filter((s: RetrievalSource) => s.type === 'path')
          .map((s) => s.detail)
          .join('; ');
        explanations.push({
          signal: 'path',
          score: pathScore,
          weight: this.weights.path_weight,
          reason: pathDetails || 'File path contains query terms',
        });
      }

      const depScore = this.computeDependencyScore(candidate);
      if (depScore > 0) {
        totalScore += depScore * this.weights.dependency_weight;
        const graphDetails = candidate.sources
          .filter((s: RetrievalSource) => s.type === 'graph')
          .map((s) => s.detail)
          .join('; ');
        explanations.push({
          signal: 'dependency',
          score: depScore,
          weight: this.weights.dependency_weight,
          reason: graphDetails || 'Connected via import/dependency graph',
        });
      }

      const moduleScore = this.computeModuleScore(candidate);
      if (moduleScore > 0) {
        totalScore += moduleScore * this.weights.module_weight;
        explanations.push({
          signal: 'module',
          score: moduleScore,
          weight: this.weights.module_weight,
          reason: 'Located in relevant module boundary',
        });
      }

      const maxPossible =
        this.weights.lexical_weight +
        this.weights.symbol_weight +
        this.weights.path_weight +
        this.weights.dependency_weight +
        this.weights.module_weight +
        this.weights.rule_weight +
        this.weights.recency_weight;

      const normalizedScore = maxPossible > 0 ? Math.min(totalScore / maxPossible, 1) : 0;

      results.push({
        filePath: candidate.filePath,
        relevance: normalizedScore,
        explanations,
        candidate,
      });
    }

    results.sort((a, b) => b.relevance - a.relevance);

    logger.debug(`Ranked ${results.length} results`);

    return results;
  }

  private computeLexicalScore(candidate: RetrievalCandidate): number {
    const keywordSources = candidate.sources.filter((s: RetrievalSource) => s.type === 'keyword');
    if (keywordSources.length === 0) return 0;

    const maxScore = Math.max(...keywordSources.map((s: RetrievalSource) => s.score));
    return Math.min(maxScore / 10, 1);
  }

  private computeSymbolScore(candidate: RetrievalCandidate): number {
    const symbolSources = candidate.sources.filter((s: RetrievalSource) => s.type === 'symbol');
    if (symbolSources.length === 0) return 0;
    return Math.min(
      symbolSources.reduce((sum: number, s: RetrievalSource) => sum + s.score, 0),
      1,
    );
  }

  private computePathScore(candidate: RetrievalCandidate): number {
    const pathSources = candidate.sources.filter((s: RetrievalSource) => s.type === 'path');
    if (pathSources.length === 0) return 0;
    return Math.min(
      pathSources.reduce((sum: number, s: RetrievalSource) => sum + s.score, 0),
      1,
    );
  }

  private computeDependencyScore(candidate: RetrievalCandidate): number {
    const graphSources = candidate.sources.filter((s: RetrievalSource) => s.type === 'graph');
    if (graphSources.length === 0) return 0;
    return Math.min(
      graphSources.reduce((sum: number, s: RetrievalSource) => sum + s.score, 0),
      1,
    );
  }

  private computeModuleScore(candidate: RetrievalCandidate): number {
    if (!candidate.file) return 0;
    const module = candidate.file.module;
    const moduleTerms = module.toLowerCase().split('/');

    let matches = 0;
    for (const term of this.queryTerms) {
      if (moduleTerms.some((mt: string) => mt.includes(term))) {
        matches++;
      }
    }

    return this.queryTerms.length > 0 ? matches / this.queryTerms.length : 0;
  }
}

import fs from 'node:fs';
import type { ContextPack, ContextFile, ProjectMeta, Rule, ContextMode } from '@codeatlas/core';
import type { RankedResult } from '@codeatlas/ranking';
import { TokenCounter } from '@codeatlas/token-counter';
import { CodeCompressor } from '@codeatlas/compression';
import { createLogger } from '@codeatlas/shared';

const logger = createLogger('context');

export interface ContextEngineOptions {
  tokenBudget: number;
  defaultMode: ContextMode;
  repositoryRoot: string;
}

export interface ContextBuildInput {
  task: string;
  project: ProjectMeta;
  rankedResults: RankedResult[];
  rules: Rule[];
  repositoryMap?: string;
}

export class ContextEngine {
  private tokenCounter: TokenCounter;
  private compressor: CodeCompressor;
  private options: ContextEngineOptions;

  constructor(options: ContextEngineOptions) {
    this.options = options;
    this.tokenCounter = new TokenCounter();
    this.compressor = new CodeCompressor();
  }

  build(input: ContextBuildInput): ContextPack {
    const startTime = Date.now();

    let remainingTokens = this.options.tokenBudget;
    const tokenBreakdown = { architecture: 0, rules: 0, repositoryMap: 0, code: 0 };

    // 1. Intelligent rule filtering and token allocation
    const taskTerms = input.task.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const prioritizedRules = [...input.rules].sort((a, b) => {
      const matchA = taskTerms.some((t) => a.content.toLowerCase().includes(t)) ? 1 : 0;
      const matchB = taskTerms.some((t) => b.content.toLowerCase().includes(t)) ? 1 : 0;
      return matchB - matchA || b.priority - a.priority;
    });

    const rulesText = prioritizedRules.map((r) => r.content).join('\n\n');
    const rulesTokens = this.tokenCounter.count(rulesText);
    const allocatedRulesTokens = Math.min(rulesTokens, Math.floor(remainingTokens * 0.15));
    tokenBreakdown.rules = allocatedRulesTokens;
    remainingTokens -= allocatedRulesTokens;

    // 2. Reserve tokens for repository map
    if (input.repositoryMap) {
      const mapTokens = this.tokenCounter.count(input.repositoryMap);
      const allocatedMapTokens = Math.min(mapTokens, Math.floor(remainingTokens * 0.15));
      tokenBreakdown.repositoryMap = allocatedMapTokens;
      remainingTokens -= allocatedMapTokens;
    }

    // 3. Progressive Code Allocation: Full for top direct matches, Skeleton/Digest for deep dependencies
    const contextFiles: ContextFile[] = [];
    let codeTokensUsed = 0;

    for (let i = 0; i < input.rankedResults.length; i++) {
      if (remainingTokens <= 0) break;

      const result = input.rankedResults[i]!;
      const filePath = result.filePath;
      const absPath = this.resolveAbsPath(filePath);

      let content: string;
      try {
        content = fs.readFileSync(absPath, 'utf-8');
      } catch {
        logger.debug(`Cannot read file for context: ${filePath}`);
        continue;
      }

      const lang = result.candidate.file?.language ?? 'unknown';

      // Progressive strategy: Top 3 results get maximum budget allowed; subsequent results are compressed to signature if budget is getting tight
      const isTopResult = i < 3 && result.relevance > 0.5;
      const maxFileBudget = isTopResult ? remainingTokens : Math.min(remainingTokens, Math.floor(this.options.tokenBudget * 0.25));

      const compressionResult = this.compressor.compress(content, lang, maxFileBudget);

      if (compressionResult.compressedTokens > remainingTokens) {
        continue;
      }

      const mode: ContextMode = compressionResult.mode;
      const finalContent = compressionResult.content;
      const tokenCount = compressionResult.compressedTokens;

      contextFiles.push({
        path: absPath,
        relativePath: filePath,
        language: result.candidate.file?.language ?? 'unknown',
        relevance: result.relevance,
        mode,
        content: finalContent,
        tokenCount,
        reasons: result.explanations,
      });

      codeTokensUsed += tokenCount;
      remainingTokens -= tokenCount;
    }

    tokenBreakdown.code = codeTokensUsed;

    const totalTokens = tokenBreakdown.rules + tokenBreakdown.repositoryMap + tokenBreakdown.code;
    const totalTime = Date.now() - startTime;

    logger.info(
      `Context built: ${contextFiles.length} files, ${totalTokens}/${this.options.tokenBudget} tokens in ${totalTime}ms`,
    );

    return {
      task: input.task,
      timestamp: new Date().toISOString(),
      repository: input.project,
      rules: input.rules,
      files: contextFiles,
      tokenBudget: this.options.tokenBudget,
      tokenUsage: totalTokens,
      tokenBreakdown,
      retrievalStats: {
        candidateCount: input.rankedResults.length,
        selectedCount: contextFiles.length,
        searchTimeMs: 0,
        rankingTimeMs: 0,
        totalTimeMs: totalTime,
      },
    };
  }

  private resolveAbsPath(relativePath: string): string {
    return `${this.options.repositoryRoot}/${relativePath}`.replace(/\\/g, '/');
  }
}

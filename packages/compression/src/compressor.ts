import type { Language, ContextMode } from '@codeatlas/core';
import { TokenCounter } from '@codeatlas/token-counter';
import { generateSkeleton } from './skeleton.js';

export interface CompressionResult {
  content: string;
  originalTokens: number;
  compressedTokens: number;
  savedTokens: number;
  reductionRatio: number;
  mode: ContextMode;
}

export class CodeCompressor {
  private tokenCounter: TokenCounter;

  constructor() {
    this.tokenCounter = new TokenCounter();
  }

  /**
   * Compress source code using semantic skeleton extraction if required by token budget.
   */
  compress(code: string, language: Language, maxBudgetTokens?: number): CompressionResult {
    const originalTokens = this.tokenCounter.count(code);

    // If already within budget and budget is provided, return original
    if (maxBudgetTokens !== undefined && originalTokens <= maxBudgetTokens) {
      return {
        content: code,
        originalTokens,
        compressedTokens: originalTokens,
        savedTokens: 0,
        reductionRatio: 0,
        mode: 'full',
      };
    }

    // Generate skeleton
    const skeletonCode = generateSkeleton(code, language);
    const skeletonTokens = this.tokenCounter.count(skeletonCode);

    if (maxBudgetTokens === undefined || skeletonTokens <= maxBudgetTokens) {
      const savedTokens = Math.max(0, originalTokens - skeletonTokens);
      const reductionRatio = originalTokens > 0 ? (savedTokens / originalTokens) * 100 : 0;

      return {
        content: skeletonCode,
        originalTokens,
        compressedTokens: skeletonTokens,
        savedTokens,
        reductionRatio: Math.round(reductionRatio * 10) / 10,
        mode: 'signature',
      };
    }

    // If even skeleton is too large, create a minimal digest
    const digest = this.createMinimalDigest(code, language);
    const digestTokens = this.tokenCounter.count(digest);
    const savedTokens = Math.max(0, originalTokens - digestTokens);
    const reductionRatio = originalTokens > 0 ? (savedTokens / originalTokens) * 100 : 0;

    return {
      content: digest,
      originalTokens,
      compressedTokens: digestTokens,
      savedTokens,
      reductionRatio: Math.round(reductionRatio * 10) / 10,
      mode: 'digest',
    };
  }

  private createMinimalDigest(code: string, _language: Language): string {
    const lines = code.split('\n');
    const exportsAndTypes: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('export ') ||
        trimmed.startsWith('import ') ||
        trimmed.startsWith('type ') ||
        trimmed.startsWith('interface ') ||
        trimmed.startsWith('class ') ||
        trimmed.startsWith('def ') ||
        trimmed.startsWith('fn ') ||
        trimmed.startsWith('func ')
      ) {
        exportsAndTypes.push(trimmed);
      }
    }

    return `// [Compressed Code Digest - ${lines.length} lines summarized]\n${exportsAndTypes.slice(0, 30).join('\n')}\n// ... and ${Math.max(0, exportsAndTypes.length - 30)} more symbols`;
  }
}

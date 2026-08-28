import type { LLMProvider } from '@codeatlas/llm';
import { Parser } from '@codeatlas/graph';
import { CODEATLAS_GRAPH_SCHEMA } from './schema-prompt.js';
import { HeuristicQueryGenerator } from './heuristics.js';

export interface NLTranslationResult {
  query: string;
  source: 'llm' | 'heuristic';
  isValid: boolean;
  error?: string;
}

export class NaturalLanguageToCypher {
  private llm?: LLMProvider;
  private heuristics = new HeuristicQueryGenerator();

  constructor(llm?: LLMProvider) {
    this.llm = llm;
  }

  async translate(naturalLanguagePrompt: string): Promise<NLTranslationResult> {
    const trimmed = naturalLanguagePrompt.trim();
    if (!trimmed) {
      return {
        query: 'MATCH (f:File) RETURN f',
        source: 'heuristic',
        isValid: true,
      };
    }

    // 1. If LLM is available and configured, attempt LLM completion
    if (this.llm && this.llm.isAvailable()) {
      try {
        const rawResponse = await this.llm.complete(trimmed, {
          systemPrompt: CODEATLAS_GRAPH_SCHEMA,
          temperature: 0.1,
          maxTokens: 512,
        });

        const cleanedQuery = this.cleanQuery(rawResponse);
        if (cleanedQuery && this.validateQuery(cleanedQuery)) {
          return {
            query: cleanedQuery,
            source: 'llm',
            isValid: true,
          };
        }
      } catch {
        // Fall through to heuristic generator on LLM error/timeout
      }
    }

    // 2. Heuristic rule-based fallback
    const heuristicQuery = this.heuristics.generate(trimmed);
    if (heuristicQuery && this.validateQuery(heuristicQuery)) {
      return {
        query: heuristicQuery,
        source: 'heuristic',
        isValid: true,
      };
    }

    // 3. Ultimate fallback: search across files/symbols matching the query text
    const sanitizedSearch = trimmed.replace(/['"\\]/g, '');
    const fallback = `MATCH (s:Symbol) WHERE s.name CONTAINS '${sanitizedSearch}' RETURN s`;

    return {
      query: fallback,
      source: 'heuristic',
      isValid: this.validateQuery(fallback),
    };
  }

  private cleanQuery(raw: string): string {
    let clean = raw.trim();
    // Remove markdown code blocks if any
    clean = clean
      .replace(/```(?:cypher|sql)?/gi, '')
      .replace(/```/g, '')
      .trim();
    // Take only the first MATCH query if multiple lines returned
    const matchIndex = clean.indexOf('MATCH');
    if (matchIndex !== -1) {
      clean = clean.substring(matchIndex);
    }
    // Remove trailing semicolons
    clean = clean.replace(/;+$/, '').trim();
    return clean;
  }

  private validateQuery(query: string): boolean {
    try {
      const parser = new Parser(query);
      const parsed = parser.parse();
      return Boolean(parsed.source && parsed.returnVariables.length > 0);
    } catch {
      return false;
    }
  }
}

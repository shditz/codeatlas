import { describe, it, expect } from 'vitest';
import type { LLMProvider, LLMOptions } from '@codeatlas-ai/llm';
import { NaturalLanguageToCypher, HeuristicQueryGenerator } from '../index.js';

class MockLLMProvider implements LLMProvider {
  name = 'mock';
  constructor(
    private response: string,
    private available = true,
  ) {}

  async complete(_prompt: string, _options?: LLMOptions): Promise<string> {
    return this.response;
  }

  isAvailable(): boolean {
    return this.available;
  }
}

describe('NL2Cypher Engine', () => {
  describe('HeuristicQueryGenerator', () => {
    const heuristics = new HeuristicQueryGenerator();

    it('generates query for all language files', () => {
      const q = heuristics.generate('all typescript files');
      expect(q).toBe("MATCH (f:File) WHERE f.language = 'typescript' RETURN f");
    });

    it('generates query for Indonesian language query', () => {
      const q = heuristics.generate('semua file php');
      expect(q).toBe("MATCH (f:File) WHERE f.language = 'php' RETURN f");
    });

    it('generates query for caller inspection', () => {
      const q = heuristics.generate('who calls handleLogin');
      expect(q).toBe(
        "MATCH (caller:Symbol)-[:CALLS]->(target:Symbol) WHERE target.name = 'handleLogin' RETURN caller",
      );
    });

    it('generates query for imported files', () => {
      const q = heuristics.generate('which files import database.ts');
      expect(q).toBe(
        "MATCH (f:File)-[:IMPORTS]->(t:File) WHERE t.name CONTAINS 'database.ts' RETURN f",
      );
    });
  });

  describe('NaturalLanguageToCypher', () => {
    it('uses LLM when available and cleans up markdown formatting', async () => {
      const mockLLM = new MockLLMProvider(
        "```cypher\nMATCH (s:Symbol)-[:EXTENDS]->(b:Symbol) WHERE b.name = 'BaseController' RETURN s\n```",
      );
      const translator = new NaturalLanguageToCypher(mockLLM);
      const res = await translator.translate('classes extending BaseController');

      expect(res.source).toBe('llm');
      expect(res.isValid).toBe(true);
      expect(res.query).toBe(
        "MATCH (s:Symbol)-[:EXTENDS]->(b:Symbol) WHERE b.name = 'BaseController' RETURN s",
      );
    });

    it('falls back to heuristics when LLM is unavailable', async () => {
      const mockLLM = new MockLLMProvider('', false);
      const translator = new NaturalLanguageToCypher(mockLLM);
      const res = await translator.translate('who calls authenticateUser');

      expect(res.source).toBe('heuristic');
      expect(res.isValid).toBe(true);
      expect(res.query).toContain("WHERE target.name = 'authenticateUser'");
    });

    it('handles empty query gracefully', async () => {
      const translator = new NaturalLanguageToCypher();
      const res = await translator.translate('');

      expect(res.isValid).toBe(true);
      expect(res.query).toBe('MATCH (f:File) RETURN f');
    });
  });
});

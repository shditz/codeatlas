import { createLogger } from '@codeatlas-ai/shared';

const logger = createLogger('llm:embeddings');

export interface EmbeddingProviderConfig {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface EmbeddingProvider {
  name: string;
  dimensions: number;
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  isAvailable(): boolean;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = 'openai';
  dimensions = 1536;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: { apiKey?: string; baseUrl?: string; model?: string; dimensions?: number }) {
    this.apiKey = config.apiKey ?? process.env['OPENAI_API_KEY'] ?? '';
    this.baseUrl = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.model = config.model ?? 'text-embedding-3-small';
    if (config.dimensions) {
      this.dimensions = config.dimensions;
    }
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey) || this.baseUrl.includes('localhost');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const results = await this.generateEmbeddings([text]);
    return results[0] ?? [];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const url = `${this.baseUrl}/embeddings`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Embedding request failed HTTP ${res.status}: ${err}`);
      }

      const data = (await res.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
      };

      const sorted = data.data.sort((a, b) => a.index - b.index);
      return sorted.map((d) => d.embedding);
    } catch (err) {
      logger.warn(`OpenAI embedding failed for model ${this.model}:`, err);
      throw err;
    }
  }
}

export class LocalHeuristicEmbeddingProvider implements EmbeddingProvider {
  name = 'local-heuristic';
  dimensions = 128;

  isAvailable(): boolean {
    return true;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.hashTextToVector(text, this.dimensions);
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.hashTextToVector(t, this.dimensions));
  }

  private hashTextToVector(text: string, dims: number): number[] {
    const vector = new Array<number>(dims).fill(0);
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) {
      return vector;
    }

    for (const word of words) {
      let hash = 5381;
      for (let i = 0; i < word.length; i++) {
        hash = (hash * 33) ^ word.charCodeAt(i);
      }
      const index = Math.abs(hash) % dims;
      vector[index] = (vector[index] ?? 0) + 1.0;
    }

    // L2 Normalize
    let norm = 0;
    for (let i = 0; i < dims; i++) {
      norm += (vector[i] ?? 0) * (vector[i] ?? 0);
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < dims; i++) {
        vector[i] = (vector[i] ?? 0) / norm;
      }
    }

    return vector;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return Math.max(-1, Math.min(1, dotProduct / denominator));
}

export function createEmbeddingProvider(config?: EmbeddingProviderConfig): EmbeddingProvider {
  const provider = config?.provider?.toLowerCase() || '';

  if (provider === 'openai' || process.env['OPENAI_API_KEY']) {
    return new OpenAIEmbeddingProvider({
      apiKey: config?.apiKey,
      baseUrl: config?.baseUrl,
      model: config?.model,
    });
  }

  if (provider === 'ollama') {
    return new OpenAIEmbeddingProvider({
      baseUrl: config?.baseUrl ?? 'http://localhost:11434/v1',
      model: config?.model ?? 'nomic-embed-text',
      dimensions: 768,
    });
  }

  return new LocalHeuristicEmbeddingProvider();
}

# Context Compression & Token Optimization

The `@codeatlas/compression` package generates high-density context digests to minimize LLM token consumption while preserving critical architectural contracts.

---

## The Need for Context Optimization

| Source Format                | Average Token Count      | Preserved Context                             |
| ---------------------------- | ------------------------ | --------------------------------------------- |
| **Raw Repository Code**      | 80,000 - 500,000+ tokens | Implementation details, comments, formatting  |
| **AST Symbol Digest**        | 4,000 - 12,000 tokens    | Interfaces, exported signatures, dependencies |
| **Topological Context Pack** | 2,000 - 8,000 tokens     | Targeted symbols relevant to specific task    |

---

## Compression Techniques

### 1. Structural Interface Digests

Replaces function and method bodies with signature declarations, preserving parameter types, return signatures, and public contracts.

```typescript
// Raw File (120 lines, ~850 tokens)
export class PaymentProcessor {
  private apiKey: string;
  constructor(key: string) {
    this.apiKey = key;
  }
  public async charge(amount: number, currency: string): Promise<ChargeResult> {
    // 60 lines of validation, network retry, error handling...
  }
}

// Compressed Digest (12 lines, ~85 tokens, 90% reduction)
export class PaymentProcessor {
  constructor(key: string);
  public charge(amount: number, currency: string): Promise<ChargeResult>;
}
```

### 2. BM25 and Topological Relevance Ranking

When assembling context packs for a query or agent instruction:

1. Candidate files are scored using BM25 across symbol names and docstrings.
2. Shortest-path distance in the dependency graph is factored into the final relevance score.
3. Top-ranking files are included fully; secondary files are included as compressed digests until the token budget is reached.

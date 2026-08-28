export class TokenCounter {
  private readonly avgCharsPerToken: number;

  constructor(avgCharsPerToken: number = 4) {
    this.avgCharsPerToken = avgCharsPerToken;
  }

  count(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / this.avgCharsPerToken);
  }

  countLines(lines: string[]): number {
    return this.count(lines.join('\n'));
  }

  fitWithinBudget(text: string, budget: number): string {
    const tokens = this.count(text);
    if (tokens <= budget) return text;

    const targetChars = budget * this.avgCharsPerToken;
    return text.slice(0, targetChars);
  }

  remaining(budget: number, used: number): number {
    return Math.max(0, budget - used);
  }
}

export function createTokenCounter(): TokenCounter {
  return new TokenCounter();
}

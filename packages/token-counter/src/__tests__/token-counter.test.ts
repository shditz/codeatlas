import { describe, it, expect } from 'vitest';
import { TokenCounter, createTokenCounter } from '../index.js';

describe('Token Counter', () => {
  it('estimates token counts and manages budget limits', () => {
    const counter = new TokenCounter();
    const counter2 = createTokenCounter();
    expect(counter2).toBeInstanceOf(TokenCounter);

    const sample = 'export class AuthService { async login() { return true; } }';
    const tokens = counter.count(sample);
    expect(tokens).toBeGreaterThan(10);

    expect(counter.remaining(1000, 400)).toBe(600);
    expect(counter.remaining(1000, 1200)).toBe(0);

    const truncated = counter.fitWithinBudget('abcdefghijklmnopqrstuvwxyz', 3);
    expect(truncated.length).toBeLessThanOrEqual(12);
  });
});

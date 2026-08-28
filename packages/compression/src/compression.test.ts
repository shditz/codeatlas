import { describe, it, expect } from 'vitest';
import { generateSkeleton, CodeCompressor } from './index.js';

describe('Compression - generateSkeleton', () => {
  it('should strip TypeScript function and class method bodies while keeping signatures', () => {
    const tsCode = `
import { Service } from './service';

export interface User {
  id: string;
  name: string;
}

export class AuthService {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
    console.log('init');
  }

  public async login(username: string, pass: string): Promise<boolean> {
    const valid = checkPass(pass);
    if (!valid) return false;
    return true;
  }
}

export function helper(val: number): number {
  return val * 2;
}
`;

    const skeleton = generateSkeleton(tsCode, 'typescript');
    expect(skeleton).toContain('export interface User');
    expect(skeleton).toContain('export class AuthService');
    expect(skeleton).toContain(
      'public async login(username: string, pass: string): Promise<boolean>',
    );
    expect(skeleton).toContain('/* [implementation hidden] */');
    expect(skeleton).not.toContain('const valid = checkPass(pass);');
    expect(skeleton).not.toContain('return val * 2;');
  });

  it('should strip Python function bodies and insert ellipsis', () => {
    const pyCode = `
import os
import sys

class DataProcessor:
    def __init__(self, data: list):
        self.data = data
        print("initialized")

    def process(self) -> dict:
        result = {}
        for item in self.data:
            result[item] = len(item)
        return result

def standalone_func(x: int) -> int:
    y = x + 10
    return y * 2
`;

    const skeleton = generateSkeleton(pyCode, 'python');
    expect(skeleton).toContain('class DataProcessor:');
    expect(skeleton).toContain('def process(self) -> dict:');
    expect(skeleton).toContain('... # [implementation hidden]');
    expect(skeleton).not.toContain('result[item] = len(item)');
    expect(skeleton).not.toContain('y = x + 10');
  });

  it('should strip Go function bodies', () => {
    const goCode = `
package main

import "fmt"

type Server struct {
    Port int
}

func (s *Server) Start() error {
    fmt.Println("Starting")
    return nil
}
`;

    const skeleton = generateSkeleton(goCode, 'go');
    expect(skeleton).toContain('type Server struct');
    expect(skeleton).toContain('func (s *Server) Start() error');
    expect(skeleton).toContain('/* [implementation hidden] */');
    expect(skeleton).not.toContain('fmt.Println("Starting")');
  });
});

describe('Compression - CodeCompressor', () => {
  it('should return full mode if code fits budget', () => {
    const compressor = new CodeCompressor();
    const code = 'const a = 1;';
    const res = compressor.compress(code, 'typescript', 1000);
    expect(res.mode).toBe('full');
    expect(res.savedTokens).toBe(0);
  });

  it('should reduce tokens when applying skeleton compression', () => {
    const compressor = new CodeCompressor();
    const code = `
export class HeavyClass {
  compute() {
    ${'const a = 1;\n'.repeat(100)}
  }
}
`;
    const res = compressor.compress(code, 'typescript', 50);
    expect(res.mode).toBe('signature');
    expect(res.reductionRatio).toBeGreaterThan(50);
    expect(res.compressedTokens).toBeLessThan(res.originalTokens);
  });
});

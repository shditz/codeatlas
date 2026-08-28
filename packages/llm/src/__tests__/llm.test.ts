import { describe, it, expect } from 'vitest';
import {
  createLLMProvider,
  NoopLLMProvider,
  OpenAiCompatibleProvider,
  AnthropicProvider,
  GeminiProvider,
} from '../index.js';

describe('Multi-LLM Providers', () => {
  it('creates DeepSeek provider', () => {
    const provider = createLLMProvider({
      provider: 'deepseek',
      apiKey: 'sk-test-deepseek',
    });
    expect(provider.name).toBe('deepseek');
    expect(provider.isAvailable()).toBe(true);
    expect(provider).toBeInstanceOf(OpenAiCompatibleProvider);
  });

  it('creates Alibaba Qwen / DashScope provider', () => {
    const provider = createLLMProvider({
      provider: 'qwen',
      apiKey: 'sk-test-qwen',
    });
    expect(provider.name).toBe('qwen');
    expect(provider.isAvailable()).toBe(true);
  });

  it('creates Moonshot Kimi provider', () => {
    const provider = createLLMProvider({
      provider: 'kimi',
      apiKey: 'sk-test-kimi',
    });
    expect(provider.name).toBe('kimi');
    expect(provider.isAvailable()).toBe(true);
  });

  it('creates xAI Grok provider', () => {
    const provider = createLLMProvider({
      provider: 'grok',
      apiKey: 'sk-test-grok',
    });
    expect(provider.name).toBe('grok');
    expect(provider.isAvailable()).toBe(true);
  });

  it('creates Ollama local provider', () => {
    const provider = createLLMProvider({
      provider: 'ollama',
    });
    expect(provider.name).toBe('ollama');
    expect(provider.isAvailable()).toBe(true);
  });

  it('creates Anthropic provider', () => {
    const provider = createLLMProvider({
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
    });
    expect(provider.name).toBe('anthropic');
    expect(provider.isAvailable()).toBe(true);
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('creates Gemini provider', () => {
    const provider = createLLMProvider({
      provider: 'gemini',
      apiKey: 'AIzaSy-test',
    });
    expect(provider.name).toBe('gemini');
    expect(provider.isAvailable()).toBe(true);
    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it('falls back to NoopLLMProvider when provider is none', () => {
    const provider = createLLMProvider({
      provider: 'none',
    });
    expect(provider.name).toBe('none');
    expect(provider.isAvailable()).toBe(false);
    expect(provider).toBeInstanceOf(NoopLLMProvider);
  });
});

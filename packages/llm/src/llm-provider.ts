import { createLogger } from '@codeatlas-ai/shared';

const logger = createLogger('llm');

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  systemPrompt?: string;
}

export interface LLMProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export interface LLMProvider {
  name: string;
  complete(prompt: string, options?: LLMOptions): Promise<string>;
  isAvailable(): boolean;
}

export class NoopLLMProvider implements LLMProvider {
  name = 'none';

  async complete(_prompt: string, _options?: LLMOptions): Promise<string> {
    return '';
  }

  isAvailable(): boolean {
    return false;
  }
}

export class OpenAiCompatibleProvider implements LLMProvider {
  public name: string;
  protected apiKey: string;
  protected baseUrl: string;
  protected defaultModel: string;
  protected timeoutMs: number;

  constructor(config: {
    name: string;
    apiKey?: string;
    baseUrl: string;
    defaultModel: string;
    timeoutMs?: number;
  }) {
    this.name = config.name;
    this.apiKey = config.apiKey ?? '';
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.defaultModel = config.defaultModel;
    this.timeoutMs = config.timeoutMs ?? 30000;
  }

  isAvailable(): boolean {
    return this.name === 'ollama' || Boolean(this.apiKey);
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const model = options?.model ?? this.defaultModel;

    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const body = {
      model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 2048,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content?.trim() ?? '';
    } catch (err) {
      logger.warn(`LLM completion failed for ${this.name}:`, err);
      throw err;
    }
  }
}

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = config.apiKey ?? process.env['ANTHROPIC_API_KEY'] ?? '';
    this.baseUrl = (config.baseUrl ?? 'https://api.anthropic.com/v1').replace(/\/$/, '');
    this.defaultModel = config.model ?? 'claude-3-5-haiku-latest';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const url = `${this.baseUrl}/messages`;
    const model = options?.model ?? this.defaultModel;

    const body = {
      model,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.2,
      system: options?.systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic HTTP ${res.status}: ${err}`);
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      return data.content?.[0]?.text?.trim() ?? '';
    } catch (err) {
      logger.warn('Anthropic completion failed:', err);
      throw err;
    }
  }
}

export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  private apiKey: string;
  private defaultModel: string;

  constructor(config: { apiKey?: string; model?: string }) {
    this.apiKey =
      config.apiKey ?? process.env['GEMINI_API_KEY'] ?? process.env['GOOGLE_API_KEY'] ?? '';
    this.defaultModel = config.model ?? 'gemini-2.0-flash';
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const model = options?.model ?? this.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxTokens ?? 2048,
      },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${err}`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    } catch (err) {
      logger.warn('Gemini completion failed:', err);
      throw err;
    }
  }
}

export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  const provider = config.provider.toLowerCase();

  switch (provider) {
    case 'deepseek':
      return new OpenAiCompatibleProvider({
        name: 'deepseek',
        apiKey: config.apiKey ?? process.env['DEEPSEEK_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://api.deepseek.com/v1',
        defaultModel: config.model ?? 'deepseek-chat',
      });

    case 'qwen':
    case 'lingma':
    case 'dashscope':
      return new OpenAiCompatibleProvider({
        name: 'qwen',
        apiKey: config.apiKey ?? process.env['DASHSCOPE_API_KEY'] ?? process.env['QWEN_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        defaultModel: config.model ?? 'qwen-plus',
      });

    case 'kimi':
    case 'moonshot':
      return new OpenAiCompatibleProvider({
        name: 'kimi',
        apiKey: config.apiKey ?? process.env['MOONSHOT_API_KEY'] ?? process.env['KIMI_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://api.moonshot.cn/v1',
        defaultModel: config.model ?? 'moonshot-v1-8k',
      });

    case 'grok':
    case 'xai':
      return new OpenAiCompatibleProvider({
        name: 'grok',
        apiKey: config.apiKey ?? process.env['XAI_API_KEY'] ?? process.env['GROK_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://api.x.ai/v1',
        defaultModel: config.model ?? 'grok-beta',
      });

    case 'ollama':
      return new OpenAiCompatibleProvider({
        name: 'ollama',
        apiKey: 'ollama',
        baseUrl: config.baseUrl ?? 'http://localhost:11434/v1',
        defaultModel: config.model ?? 'qwen2.5-coder:7b',
      });

    case 'openai':
      return new OpenAiCompatibleProvider({
        name: 'openai',
        apiKey: config.apiKey ?? process.env['OPENAI_API_KEY'],
        baseUrl: config.baseUrl ?? 'https://api.openai.com/v1',
        defaultModel: config.model ?? 'gpt-4o-mini',
      });

    case 'anthropic':
    case 'claude':
      return new AnthropicProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
      });

    case 'gemini':
      return new GeminiProvider({
        apiKey: config.apiKey,
        model: config.model,
      });

    case 'none':
    default:
      return new NoopLLMProvider();
  }
}

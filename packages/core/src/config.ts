import { z } from 'zod';

export const ProjectConfigSchema = z.object({
  name: z.string().default(''),
});

export const IndexConfigSchema = z.object({
  follow_symlinks: z.boolean().default(false),
  include_tests: z.boolean().default(true),
  max_file_size: z.number().default(1_048_576),
});

export const RankingConfigSchema = z.object({
  lexical_weight: z.number().min(0).max(1).default(0.25),
  symbol_weight: z.number().min(0).max(1).default(0.2),
  path_weight: z.number().min(0).max(1).default(0.15),
  dependency_weight: z.number().min(0).max(1).default(0.15),
  rule_weight: z.number().min(0).max(1).default(0.1),
  recency_weight: z.number().min(0).max(1).default(0.1),
  module_weight: z.number().min(0).max(1).default(0.05),
});

export const ContextConfigSchema = z.object({
  max_tokens: z.number().default(12_000),
  default_mode: z.enum(['full', 'signature', 'summary', 'digest']).default('full'),
});

export const SecurityConfigSchema = z.object({
  scan_secrets: z.boolean().default(true),
  exclude_patterns: z.array(z.string()).default(['.env', '*.pem', '*.key']),
});

export const AIConfigSchema = z.object({
  provider: z.string().default('none'),
  model: z.string().optional(),
  api_key: z.string().optional(),
  base_url: z.string().optional(),
});

export const ArchitectureRulesConfigSchema = z.object({
  allow: z.array(z.string()).default([]),
  disallow: z.array(z.string()).default([]),
  enforce_public_api: z.boolean().default(true),
});

export const ArchitectureConfigSchema = z.object({
  type: z.enum(['layered', 'ddd', 'clean', 'hexagonal', 'custom', 'auto']).default('auto'),
  layers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  bounded_contexts: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  rules: ArchitectureRulesConfigSchema.default({}),
});

export const AtlasConfigSchema = z.object({
  project: ProjectConfigSchema.default({}),
  index: IndexConfigSchema.default({}),
  ranking: RankingConfigSchema.default({}),
  context: ContextConfigSchema.default({}),
  security: SecurityConfigSchema.default({}),
  architecture: ArchitectureConfigSchema.default({}),
  ai: AIConfigSchema.default({}),
});

export type AtlasConfig = z.infer<typeof AtlasConfigSchema>;
export type RankingConfig = z.infer<typeof RankingConfigSchema>;
export type ContextConfig = z.infer<typeof ContextConfigSchema>;
export type ArchitectureConfig = z.infer<typeof ArchitectureConfigSchema>;
export type ArchitectureRulesConfig = z.infer<typeof ArchitectureRulesConfigSchema>;

export function parseConfig(raw: unknown): AtlasConfig {
  return AtlasConfigSchema.parse(raw);
}

export function defaultConfig(): AtlasConfig {
  return AtlasConfigSchema.parse({});
}

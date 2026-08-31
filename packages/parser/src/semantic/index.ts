import type { Language } from '@codeatlas-ai/core';
import type { SemanticResolver, SemanticResolverOptions, SemanticProjectResult } from './types.js';
import { TypeScriptSemanticResolver } from './ts-semantic-resolver.js';

export * from './types.js';
export { TypeScriptSemanticResolver } from './ts-semantic-resolver.js';

const resolvers: SemanticResolver[] = [new TypeScriptSemanticResolver()];

export function getSemanticResolverForLanguage(lang: Language): SemanticResolver | undefined {
  return resolvers.find((r) => r.canResolve(lang));
}

export async function resolveProjectSemantics(
  filePaths: string[],
  options: SemanticResolverOptions,
): Promise<SemanticProjectResult> {
  const tsResolver = new TypeScriptSemanticResolver();
  return tsResolver.resolveProject(filePaths, options);
}

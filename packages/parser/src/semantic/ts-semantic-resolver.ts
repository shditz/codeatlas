import path from 'node:path';
import fs from 'node:fs';
import ts from 'typescript';
import type { Language } from '@codeatlas-ai/core';
import { createLogger } from '@codeatlas-ai/shared';
import type {
  SemanticResolver,
  SemanticResolverOptions,
  SemanticProjectResult,
  SemanticEdge,
} from './types.js';

const logger = createLogger('parser:semantic-ts');

export class TypeScriptSemanticResolver implements SemanticResolver {
  canResolve(language: Language): boolean {
    return (
      language === 'typescript' ||
      language === 'javascript' ||
      language === 'json' ||
      language === 'html'
    );
  }

  public async resolveProject(
    filePaths: string[],
    options: SemanticResolverOptions,
  ): Promise<SemanticProjectResult> {
    const rootDir = path.resolve(options.rootDir);
    const tsConfigPath = options.tsConfigPath
      ? path.resolve(rootDir, options.tsConfigPath)
      : this.findTsConfig(rootDir);

    const compilerOptions = this.loadCompilerOptions(rootDir, tsConfigPath);
    const absoluteFiles = filePaths
      .map((p) => path.resolve(rootDir, p))
      .filter((p) => fs.existsSync(p));

    if (absoluteFiles.length === 0) {
      return {
        edges: [],
        resolvedAliases: new Map(),
        heritageHierarchy: new Map(),
      };
    }

    logger.debug(
      `Initializing TypeScript Program with ${absoluteFiles.length} files (tsconfig: ${tsConfigPath ? path.basename(tsConfigPath) : 'default'})...`,
    );

    let program: ts.Program;
    try {
      program = ts.createProgram({
        rootNames: absoluteFiles,
        options: compilerOptions,
      });
    } catch (err) {
      logger.warn(`Failed to create TypeScript program: ${err}`);
      return {
        edges: [],
        resolvedAliases: new Map(),
        heritageHierarchy: new Map(),
      };
    }

    const typeChecker = program.getTypeChecker();
    const edges: SemanticEdge[] = [];
    const resolvedAliases = new Map<string, string>();
    const heritageHierarchy = new Map<string, { extends?: string[]; implements?: string[] }>();

    const sourceFiles = program.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      const fileName = sourceFile.fileName;
      if (
        fileName.includes('node_modules') ||
        (fileName.endsWith('.d.ts') && !absoluteFiles.some((f) => path.resolve(f) === path.resolve(fileName)))
      ) {
        continue;
      }

      const relativeSource = this.normalizeRelative(path.relative(rootDir, fileName));

      ts.forEachChild(sourceFile, (node) => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
          const moduleSpecifier = node.moduleSpecifier;
          if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
            const importPath = moduleSpecifier.text;
            const resolvedTarget = this.resolveModule(
              importPath,
              fileName,
              compilerOptions,
              rootDir,
            );

            if (resolvedTarget) {
              resolvedAliases.set(`${relativeSource}::${importPath}`, resolvedTarget);

              const symbols: string[] = [];
              if (ts.isImportDeclaration(node) && node.importClause) {
                if (node.importClause.name) {
                  symbols.push(node.importClause.name.text);
                }
                if (
                  node.importClause.namedBindings &&
                  ts.isNamedImports(node.importClause.namedBindings)
                ) {
                  for (const spec of node.importClause.namedBindings.elements) {
                    symbols.push(spec.name.text);
                  }
                }
              }

              edges.push({
                sourceFile: relativeSource,
                targetFile: resolvedTarget,
                kind: 'import',
                symbols,
                weight: 1.0,
                confidence: 1.0,
                resolution: 'semantic-ts',
                detail: `Resolved module "${importPath}" via TypeScript Compiler`,
              });
            }
          }
        }

        if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
          const nameNode = node.name;
          const entityName = nameNode ? nameNode.text : 'Anonymous';

          if (node.heritageClauses) {
            for (const clause of node.heritageClauses) {
              const isExtends = clause.token === ts.SyntaxKind.ExtendsKeyword;
              const isImplements = clause.token === ts.SyntaxKind.ImplementsKeyword;
              const kind = isExtends ? 'extends' : 'implements';

              for (const typeNode of clause.types) {
                const expr = typeNode.expression;
                const parentName = expr.getText(sourceFile);

                let symbol = typeChecker.getSymbolAtLocation(expr);
                if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
                  try {
                    symbol = typeChecker.getAliasedSymbol(symbol);
                  } catch {
                    // ignore alias resolution failure
                  }
                }
                let targetRelativePath: string | undefined;

                if (symbol && symbol.declarations && symbol.declarations.length > 0) {
                  const targetDecl = symbol.declarations[0];
                  if (targetDecl) {
                    const targetFile = targetDecl.getSourceFile().fileName;
                    if (!targetFile.includes('node_modules')) {
                      targetRelativePath = this.normalizeRelative(
                        path.relative(rootDir, targetFile),
                      );
                    }
                  }
                }

                if (targetRelativePath && targetRelativePath !== relativeSource) {
                  edges.push({
                    sourceFile: relativeSource,
                    targetFile: targetRelativePath,
                    kind,
                    symbols: [parentName],
                    weight: isExtends ? 1.5 : 1.2,
                    confidence: 1.0,
                    resolution: 'semantic-ts',
                    detail: `${entityName} ${kind} ${parentName} in ${targetRelativePath}`,
                  });
                }

                const key = `${relativeSource}#${entityName}`;
                const existing = heritageHierarchy.get(key) ?? {};
                if (isExtends) {
                  existing.extends = [...(existing.extends ?? []), parentName];
                } else if (isImplements) {
                  existing.implements = [...(existing.implements ?? []), parentName];
                }
                heritageHierarchy.set(key, existing);
              }
            }
          }
        }
      });
    }

    const edgeMap = new Map<string, SemanticEdge>();
    for (const edge of edges) {
      const key = `${edge.sourceFile}->${edge.targetFile}:${edge.kind}`;
      const existing = edgeMap.get(key);
      if (existing) {
        existing.symbols = Array.from(new Set([...existing.symbols, ...edge.symbols]));
        existing.weight = Math.max(existing.weight, edge.weight);
      } else {
        edgeMap.set(key, { ...edge });
      }
    }

    logger.debug(
      `Semantic TypeScript resolution extracted ${edgeMap.size} unique semantic edges.`,
    );

    return {
      edges: Array.from(edgeMap.values()),
      resolvedAliases,
      heritageHierarchy,
    };
  }

  private resolveModule(
    importPath: string,
    containingFile: string,
    compilerOptions: ts.CompilerOptions,
    rootDir: string,
  ): string | undefined {
    const resolved = ts.resolveModuleName(
      importPath,
      containingFile,
      compilerOptions,
      ts.sys,
    );

    if (resolved && resolved.resolvedModule) {
      const resolvedFileName = resolved.resolvedModule.resolvedFileName;
      if (resolvedFileName.includes('node_modules')) {
        return undefined;
      }
      return this.normalizeRelative(path.relative(rootDir, resolvedFileName));
    }

    return undefined;
  }

  private findTsConfig(rootDir: string): string | undefined {
    const candidates = [
      path.join(rootDir, 'tsconfig.json'),
      path.join(rootDir, 'jsconfig.json'),
      path.join(rootDir, 'tsconfig.base.json'),
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
    return undefined;
  }

  private loadCompilerOptions(rootDir: string, tsConfigPath?: string): ts.CompilerOptions {
    if (tsConfigPath && fs.existsSync(tsConfigPath)) {
      const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
      if (!configFile.error) {
        const parsed = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          path.dirname(tsConfigPath),
        );
        return {
          ...parsed.options,
          moduleResolution: parsed.options.moduleResolution ?? ts.ModuleResolutionKind.Bundler,
          allowJs: true,
          noEmit: true,
        };
      }
    }

    return {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowJs: true,
      checkJs: false,
      noEmit: true,
      baseUrl: rootDir,
    };
  }

  private normalizeRelative(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  }
}

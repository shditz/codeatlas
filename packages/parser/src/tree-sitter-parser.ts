import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SymbolInfo, ImportInfo, SymbolKind, Language } from '@codeatlas-ai/core';
import { createLogger } from '@codeatlas-ai/shared';

const logger = createLogger('parser');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeRequire(moduleName: string): any {
  const candidateUrls: string[] = [
    typeof import.meta?.url === 'string' ? import.meta.url : '',
    pathToFileURL(path.resolve(process.cwd(), 'dummy.js')).href,
    pathToFileURL(path.resolve(process.cwd(), 'apps/cli/dummy.js')).href,
    pathToFileURL(path.resolve(process.cwd(), 'packages/parser/dummy.js')).href,
  ].filter(Boolean);

  if (typeof require !== 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(moduleName);
    } catch {
      // try next
    }
  }

  for (const url of candidateUrls) {
    try {
      const req = createRequire(url);
      return req(moduleName);
    } catch {
      // try next
    }
  }
  throw new Error(`Cannot resolve module '${moduleName}'`);
}

let ParserClass: unknown = null;
const languageGrammars: Partial<Record<Language, unknown>> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getParserClass(): any {
  if (!ParserClass) {
    ParserClass = safeRequire('tree-sitter');
  }
  return ParserClass;
}

function getLanguage(lang: Language, filePath?: string): unknown {
  const isTsx = filePath?.endsWith('.tsx') || filePath?.endsWith('.jsx');
  const cacheKey = isTsx ? `${lang}:tsx` : lang;
  if (languageGrammars[cacheKey]) {
    return languageGrammars[cacheKey];
  }

  let grammar: unknown = null;
  switch (lang) {
    case 'typescript': {
      try {
        const mod = safeRequire('tree-sitter-typescript');
        grammar = isTsx
          ? (mod.tsx ?? mod.typescript ?? mod.default ?? mod)
          : (mod.typescript ?? mod.default ?? mod);
      } catch {
        grammar = null;
      }
      break;
    }
    case 'javascript': {
      try {
        const mod = safeRequire('tree-sitter-javascript');
        grammar = mod.default ?? mod;
      } catch {
        grammar = null;
      }
      break;
    }
    case 'python': {
      try {
        const mod = safeRequire('tree-sitter-python');
        grammar = mod.default ?? mod;
      } catch {
        grammar = null;
      }
      break;
    }
    case 'go': {
      try {
        const mod = safeRequire('tree-sitter-go');
        grammar = mod.default ?? mod;
      } catch {
        grammar = null;
      }
      break;
    }
    case 'rust': {
      try {
        const mod = safeRequire('tree-sitter-rust');
        grammar = mod.default ?? mod;
      } catch {
        grammar = null;
      }
      break;
    }
    case 'php': {
      try {
        const mod = safeRequire('tree-sitter-php');
        grammar = mod.php ?? mod.default ?? mod;
      } catch {
        grammar = null;
      }
      break;
    }
    case 'java': {
      try {
        const mod = safeRequire('tree-sitter-java');
        grammar = mod.default ?? mod;
      } catch {
        grammar = null;
      }
      break;
    }
    case 'csharp': {
      try {
        const mod = safeRequire('tree-sitter-c-sharp');
        grammar = mod.default ?? mod;
      } catch {
        grammar = null;
      }
      break;
    }
    case 'cpp':
    case 'c': {
      try {
        const mod = safeRequire('tree-sitter-cpp');
        grammar = mod.default ?? mod;
      } catch {
        grammar = null;
      }
      break;
    }
    default:
      grammar = null;
  }

  if (grammar) {
    languageGrammars[lang] = grammar;
  }
  return grammar;
}

export interface ParseResult {
  symbols: SymbolInfo[];
  imports: ImportInfo[];
  exportedNames: string[];
  errors: string[];
}

export interface AstNode {
  type: string;
  text: string;
  namedChildren: AstNode[];
  children: AstNode[];
  parent: AstNode | null;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  childForFieldName: (name: string) => AstNode | null;
}

export async function parseFile(
  filePath: string,
  content: string,
  language: Language,
): Promise<ParseResult> {
  const symbols: SymbolInfo[] = [];
  const imports: ImportInfo[] = [];
  const exportedNames: string[] = [];
  const errors: string[] = [];

  try {
    let treeParsed = false;
    const treeSitterSupported = ['typescript', 'javascript', 'python', 'go', 'rust', 'php'];

    if (treeSitterSupported.includes(language)) {
      try {
        const lang = getLanguage(language, filePath);
        if (lang) {
          const ParserConstructor = getParserClass();
          const parser = new ParserConstructor();
          parser.setLanguage(lang);

          const tree = parser.parse(content);
          const root = tree.rootNode as unknown as AstNode;

          switch (language) {
            case 'typescript':
            case 'javascript':
              extractTypeScriptSymbols(root, filePath, symbols, imports, exportedNames, null);
              extractTypeScriptImports(root, filePath, imports);
              treeParsed = true;
              break;

            case 'python':
              extractPythonSymbols(root, filePath, symbols, exportedNames, null);
              extractPythonImports(root, filePath, imports);
              treeParsed = true;
              break;

            case 'go':
              extractGoSymbols(root, filePath, symbols, exportedNames, null);
              extractGoImports(root, filePath, imports);
              treeParsed = true;
              break;

            case 'rust':
              extractRustSymbols(root, filePath, symbols, exportedNames, null);
              extractRustImports(root, filePath, imports);
              treeParsed = true;
              break;

            case 'php':
              extractPhpSymbolsTreeSitter(root, filePath, symbols, exportedNames, null);
              extractPhpImportsTreeSitter(root, filePath, imports);
              treeParsed = true;
              break;
          }

          if (tree.rootNode.hasError) {
            errors.push(`Parse tree contains errors for ${filePath}`);
          }
        }
      } catch (tsErr) {
        logger.debug(`Tree-sitter parse fallback for ${language} in ${filePath}: ${tsErr}`);
      }
    }

    if (!treeParsed) {
      switch (language) {
        case 'typescript':
        case 'javascript':
          extractTypeScriptSymbolsAndImportsRegex(
            content,
            filePath,
            symbols,
            imports,
            exportedNames,
          );
          break;
        case 'python':
          extractPythonSymbolsAndImportsRegex(content, filePath, symbols, imports, exportedNames);
          break;
        case 'go':
          extractGoSymbolsAndImportsRegex(content, filePath, symbols, imports, exportedNames);
          break;
        case 'rust':
          extractRustSymbolsAndImportsRegex(content, filePath, symbols, imports, exportedNames);
          break;
        case 'php':
          extractPhpSymbolsAndImports(content, filePath, symbols, imports, exportedNames);
          break;
        case 'csharp':
          extractCSharpSymbolsAndImports(content, filePath, symbols, imports, exportedNames);
          break;
        case 'cpp':
        case 'c':
          extractCppSymbolsAndImports(content, filePath, symbols, imports, exportedNames);
          break;
        case 'java':
          extractJavaSymbolsAndImports(content, filePath, symbols, imports, exportedNames);
          break;
        case 'ruby':
          extractRubySymbolsAndImports(content, filePath, symbols, imports, exportedNames);
          break;
        case 'kotlin':
          extractKotlinSymbolsAndImports(content, filePath, symbols, imports, exportedNames);
          break;
        case 'swift':
          extractSwiftSymbolsAndImports(content, filePath, symbols, imports, exportedNames);
          break;
        case 'prisma':
          extractPrismaSymbolsAndImports(content, filePath, symbols, imports, exportedNames);
          break;
        default:
          break;
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to parse ${filePath}: ${msg}`);
    logger.debug(`Parse error for ${filePath}: ${msg}`);
  }

  return { symbols, imports, exportedNames, errors };
}

function isReactHookName(name: string): boolean {
  return /^use[A-Z0-9]/.test(name);
}

function resolveNextJsRouteSymbolKind(
  filePath: string,
  name: string,
  isExported: boolean,
): SymbolKind | null {
  const normalized = filePath.replace(/\\/g, '/');
  const match = normalized.match(/(?:^|\/)app\/(?:(.+?)\/)?([^/]+)\.(?:tsx|ts|jsx|js)$/);
  if (!match) return null;

  const filename = match[2];
  if (
    filename === 'page' &&
    (isExported || name === 'default' || name === 'Page' || name.toLowerCase().includes('page'))
  ) {
    return 'page';
  }
  if (
    filename === 'layout' &&
    (isExported || name === 'default' || name === 'Layout' || name.toLowerCase().includes('layout'))
  ) {
    return 'layout';
  }
  if (
    filename === 'route' &&
    ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(name)
  ) {
    return 'route_handler';
  }
  return null;
}

function resolveNestJsClassKind(node: AstNode): SymbolKind | null {
  const checkText = (txt: string): SymbolKind | null => {
    if (/@Controller\s*(?:\(|$)/.test(txt)) return 'controller';
    if (/@Injectable\s*(?:\(|$)|@Service\s*(?:\(|$)|@Repository\s*(?:\(|$)/.test(txt))
      return 'provider';
    if (/@Module\s*(?:\(|$)/.test(txt)) return 'module';
    return null;
  };

  const direct = checkText(node.text);
  if (direct) return direct;
  if (node.parent) {
    const parentCheck = checkText(node.parent.text);
    if (parentCheck) return parentCheck;
  }
  return null;
}

function extractTypeScriptSymbols(
  node: AstNode,
  filePath: string,
  symbols: SymbolInfo[],
  imports: ImportInfo[],
  exportedNames: string[],
  parentName: string | null,
): void {
  for (const child of node.namedChildren) {
    const isExported = isExportedNode(child);

    switch (child.type) {
      case 'function_declaration':
      case 'generator_function_declaration': {
        const rawName = child.childForFieldName('name')?.text ?? '';
        const isDefaultExport = isExported && (child.parent?.text.includes('default') ?? false);
        const name = rawName || (isDefaultExport ? 'default' : '');
        if (name) {
          let kind: SymbolKind = 'function';
          const nextKind = resolveNextJsRouteSymbolKind(filePath, name, isExported);
          if (nextKind) {
            kind = nextKind;
          } else if (isReactHookName(name)) {
            kind = 'hook';
          }
          symbols.push(makeSymbol(name, kind, filePath, child, isExported, parentName));
          if (isExported) exportedNames.push(name);
        }
        break;
      }

      case 'class_declaration': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          const nestKind = resolveNestJsClassKind(child);
          const kind: SymbolKind = nestKind ?? 'class';
          symbols.push(makeSymbol(name, kind, filePath, child, isExported, parentName));
          if (isExported) exportedNames.push(name);
          extractTypeScriptClassMembers(child, filePath, symbols, name);
        }
        break;
      }

      case 'interface_declaration': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          symbols.push(makeSymbol(name, 'interface', filePath, child, isExported, parentName));
          if (isExported) exportedNames.push(name);
        }
        break;
      }

      case 'type_alias_declaration': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          symbols.push(makeSymbol(name, 'type', filePath, child, isExported, parentName));
          if (isExported) exportedNames.push(name);
        }
        break;
      }

      case 'enum_declaration': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          symbols.push(makeSymbol(name, 'enum', filePath, child, isExported, parentName));
          if (isExported) exportedNames.push(name);
        }
        break;
      }

      case 'lexical_declaration':
      case 'variable_declaration': {
        extractTypeScriptVariableDeclarations(
          child,
          filePath,
          symbols,
          exportedNames,
          isExported,
          parentName,
        );
        break;
      }

      case 'export_statement': {
        extractTypeScriptSymbols(child, filePath, symbols, imports, exportedNames, parentName);
        extractTypeScriptExportedNames(child, exportedNames);

        const reExportSource = child.childForFieldName('source')?.text?.replace(/['"]/g, '');
        if (reExportSource) {
          const reExportedSymbols: string[] = [];
          for (const sub of child.namedChildren) {
            if (sub.type === 'export_clause') {
              for (const spec of sub.namedChildren) {
                if (spec.type === 'export_specifier') {
                  const alias = spec.childForFieldName('alias')?.text;
                  const name = spec.childForFieldName('name')?.text ?? spec.text;
                  reExportedSymbols.push(alias || name);
                }
              }
            }
          }
          const isNamespaceReExport = child.text.includes('export *');
          imports.push({
            filePath,
            importPath: reExportSource,
            symbols: reExportedSymbols,
            isDefault: false,
            isNamespace: isNamespaceReExport,
            isType: child.text.includes('export type'),
          });
        }
        break;
      }

      default:
        if (child.namedChildren.length > 0 && !isBlockNode(child.type)) {
          extractTypeScriptSymbols(child, filePath, symbols, imports, exportedNames, parentName);
        }
        break;
    }
  }
}

function extractTypeScriptClassMembers(
  classNode: AstNode,
  filePath: string,
  symbols: SymbolInfo[],
  className: string,
): void {
  const body = classNode.childForFieldName('body');
  if (!body) return;

  for (const member of body.namedChildren) {
    if (member.type === 'method_definition' || member.type === 'public_field_definition') {
      const name = member.childForFieldName('name')?.text ?? '';
      if (name) {
        const kind: SymbolKind = member.type === 'method_definition' ? 'method' : 'property';
        symbols.push(makeSymbol(name, kind, filePath, member, false, className));
      }
    }
  }
}

function extractTypeScriptVariableDeclarations(
  node: AstNode,
  filePath: string,
  symbols: SymbolInfo[],
  exportedNames: string[],
  isExported: boolean,
  parentName: string | null,
): void {
  for (const declarator of node.namedChildren) {
    if (declarator.type === 'variable_declarator') {
      const nameNode = declarator.childForFieldName('name');
      const name = nameNode?.text ?? '';
      if (!name) continue;

      const value = declarator.childForFieldName('value');
      const isArrowFn = value?.type === 'arrow_function' || value?.type === 'function';
      let kind: SymbolKind = isArrowFn
        ? 'function'
        : isConstant(node.text)
          ? 'constant'
          : 'variable';

      if (isArrowFn) {
        const nextKind = resolveNextJsRouteSymbolKind(filePath, name, isExported);
        if (nextKind) {
          kind = nextKind;
        } else if (isReactHookName(name)) {
          kind = 'hook';
        }
      }

      symbols.push(makeSymbol(name, kind, filePath, declarator, isExported, parentName));
      if (isExported) exportedNames.push(name);
    }
  }
}

function extractTypeScriptImports(node: AstNode, filePath: string, imports: ImportInfo[]): void {
  for (const child of node.namedChildren) {
    if (child.type === 'import_statement') {
      const source = child.childForFieldName('source')?.text?.replace(/['"]/g, '') ?? '';
      if (!source) continue;

      const importedSymbols: string[] = [];
      let isDefault = false;
      let isNamespace = false;
      let isType = child.text.includes('import type');

      for (const clause of child.namedChildren) {
        if (clause.type === 'import_clause') {
          for (const spec of clause.namedChildren) {
            if (spec.type === 'identifier') {
              isDefault = true;
              importedSymbols.push(spec.text);
            } else if (spec.type === 'named_imports') {
              for (const named of spec.namedChildren) {
                if (named.type === 'import_specifier') {
                  const name = named.childForFieldName('name')?.text ?? named.text;
                  importedSymbols.push(name);
                }
              }
            } else if (spec.type === 'namespace_import') {
              isNamespace = true;
              const alias = spec.childForFieldName('name')?.text;
              if (alias) importedSymbols.push(alias);
            }
          }
        }
      }

      if (!isType) {
        isType = child.text.startsWith('import type');
      }

      imports.push({
        filePath,
        importPath: source,
        symbols: importedSymbols,
        isDefault,
        isNamespace,
        isType,
      });
    }
  }
}

function extractTypeScriptExportedNames(node: AstNode, exportedNames: string[]): void {
  for (const child of node.namedChildren) {
    if (child.type === 'export_clause') {
      for (const spec of child.namedChildren) {
        if (spec.type === 'export_specifier') {
          const name = spec.childForFieldName('name')?.text ?? spec.text;
          exportedNames.push(name);
        }
      }
    }
  }
}

function extractPythonSymbols(
  node: AstNode,
  filePath: string,
  symbols: SymbolInfo[],
  exportedNames: string[],
  parentName: string | null,
): void {
  for (const child of node.namedChildren) {
    switch (child.type) {
      case 'function_definition':
      case 'async_function_definition': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          const kind: SymbolKind = parentName ? 'method' : 'function';
          const isExported = !name.startsWith('_');
          symbols.push(makeSymbol(name, kind, filePath, child, isExported, parentName));
          if (isExported && !parentName) exportedNames.push(name);
        }
        break;
      }

      case 'class_definition': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          const isExported = !name.startsWith('_');
          symbols.push(makeSymbol(name, 'class', filePath, child, isExported, parentName));
          if (isExported && !parentName) exportedNames.push(name);

          const body = child.childForFieldName('body');
          if (body) {
            extractPythonSymbols(body, filePath, symbols, exportedNames, name);
          }
        }
        break;
      }

      case 'decorated_definition': {
        const definition = child.childForFieldName('definition');
        if (definition) {
          extractPythonSymbols(
            { ...definition, parent: child },
            filePath,
            symbols,
            exportedNames,
            parentName,
          );
        }
        break;
      }

      default:
        if (child.namedChildren.length > 0 && child.type !== 'block') {
          extractPythonSymbols(child, filePath, symbols, exportedNames, parentName);
        }
        break;
    }
  }
}

function extractPythonImports(node: AstNode, filePath: string, imports: ImportInfo[]): void {
  for (const child of node.namedChildren) {
    if (child.type === 'import_statement') {
      for (const nameNode of child.namedChildren) {
        if (nameNode.type === 'dotted_name' || nameNode.type === 'aliased_import') {
          const raw = nameNode.childForFieldName('name')?.text ?? nameNode.text;
          imports.push({
            filePath,
            importPath: raw,
            symbols: [raw],
            isDefault: true,
            isNamespace: true,
            isType: false,
          });
        }
      }
    } else if (child.type === 'import_from_statement') {
      const moduleNode = child.childForFieldName('module_name');
      const moduleName = moduleNode?.text ?? '';
      const importedSymbols: string[] = [];

      for (const sub of child.namedChildren) {
        if (sub.type === 'dotted_name' && sub !== moduleNode) {
          importedSymbols.push(sub.text);
        } else if (sub.type === 'aliased_import') {
          const name = sub.childForFieldName('name')?.text ?? sub.text;
          importedSymbols.push(name);
        }
      }

      imports.push({
        filePath,
        importPath: moduleName,
        symbols: importedSymbols,
        isDefault: false,
        isNamespace: false,
        isType: false,
      });
    }
  }
}

function extractGoSymbols(
  node: AstNode,
  filePath: string,
  symbols: SymbolInfo[],
  exportedNames: string[],
  parentName: string | null,
): void {
  for (const child of node.namedChildren) {
    switch (child.type) {
      case 'function_declaration': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          const isExported = isGoExported(name);
          symbols.push(makeSymbol(name, 'function', filePath, child, isExported, parentName));
          if (isExported) exportedNames.push(name);
        }
        break;
      }

      case 'method_declaration': {
        const name = child.childForFieldName('name')?.text ?? '';
        const receiver = child.childForFieldName('receiver')?.text ?? '';
        if (name) {
          const isExported = isGoExported(name);
          symbols.push(makeSymbol(name, 'method', filePath, child, isExported, receiver || null));
          if (isExported) exportedNames.push(name);
        }
        break;
      }

      case 'type_declaration': {
        for (const spec of child.namedChildren) {
          if (spec.type === 'type_spec') {
            const name = spec.childForFieldName('name')?.text ?? '';
            const typeNode = spec.childForFieldName('type');
            const typeKind = typeNode?.type === 'interface_type' ? 'interface' : 'struct';
            if (name) {
              const isExported = isGoExported(name);
              symbols.push(makeSymbol(name, typeKind, filePath, spec, isExported, parentName));
              if (isExported) exportedNames.push(name);
            }
          }
        }
        break;
      }

      default:
        break;
    }
  }
}

function extractGoImports(node: AstNode, filePath: string, imports: ImportInfo[]): void {
  for (const child of node.namedChildren) {
    if (child.type === 'import_declaration') {
      const specs: AstNode[] = [];
      for (const spec of child.namedChildren) {
        if (spec.type === 'import_spec') {
          specs.push(spec);
        } else if (spec.type === 'import_spec_list') {
          for (const sub of spec.namedChildren) {
            if (sub.type === 'import_spec') {
              specs.push(sub);
            }
          }
        }
      }

      for (const spec of specs) {
        const path =
          spec.childForFieldName('path')?.text?.replace(/['"]/g, '') ??
          spec.text.replace(/['"]/g, '').trim();
        if (path) {
          imports.push({
            filePath,
            importPath: path,
            symbols: [path],
            isDefault: true,
            isNamespace: false,
            isType: false,
          });
        }
      }
    }
  }
}

function isGoExported(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function extractRustSymbols(
  node: AstNode,
  filePath: string,
  symbols: SymbolInfo[],
  exportedNames: string[],
  parentName: string | null,
): void {
  for (const child of node.namedChildren) {
    const isPub = child.text.trimStart().startsWith('pub');

    switch (child.type) {
      case 'function_item': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          const kind: SymbolKind = parentName ? 'method' : 'function';
          symbols.push(makeSymbol(name, kind, filePath, child, isPub, parentName));
          if (isPub) exportedNames.push(name);
        }
        break;
      }

      case 'struct_item': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          symbols.push(makeSymbol(name, 'struct', filePath, child, isPub, parentName));
          if (isPub) exportedNames.push(name);
        }
        break;
      }

      case 'enum_item': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          symbols.push(makeSymbol(name, 'enum', filePath, child, isPub, parentName));
          if (isPub) exportedNames.push(name);
        }
        break;
      }

      case 'trait_item': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          symbols.push(makeSymbol(name, 'trait', filePath, child, isPub, parentName));
          if (isPub) exportedNames.push(name);
        }
        break;
      }

      case 'impl_item': {
        const typeName = child.childForFieldName('type')?.text ?? '';
        const traitName = child.childForFieldName('trait')?.text;
        const implName = traitName ? `${traitName} for ${typeName}` : typeName;

        const body = child.childForFieldName('body');
        if (body) {
          extractRustSymbols(body, filePath, symbols, exportedNames, implName);
        }
        break;
      }

      default:
        break;
    }
  }
}

function extractRustImports(node: AstNode, filePath: string, imports: ImportInfo[]): void {
  for (const child of node.namedChildren) {
    if (child.type === 'use_declaration') {
      const path =
        child.childForFieldName('argument')?.text ??
        child.text.replace(/^pub\s+use\s+|use\s+|;$/g, '').trim();
      imports.push({
        filePath,
        importPath: path,
        symbols: [path],
        isDefault: false,
        isNamespace: false,
        isType: false,
      });
    }
  }
}

export function calculateAstCyclomaticComplexity(node: AstNode): number {
  let complexity = 1;

  function traverse(n: AstNode): void {
    const type = n.type;
    if (
      type === 'if_statement' ||
      type === 'for_statement' ||
      type === 'for_in_statement' ||
      type === 'while_statement' ||
      type === 'do_statement' ||
      type === 'ternary_expression' ||
      type === 'conditional_expression' ||
      type === 'catch_clause' ||
      type === 'switch_case' ||
      type === 'case_clause' ||
      type === 'elif_clause' ||
      type === 'match_arm'
    ) {
      complexity++;
    } else if (type === 'binary_expression') {
      const op = n.childForFieldName('operator')?.text;
      if (op === '&&' || op === '||' || op === '??' || op === 'and' || op === 'or') {
        complexity++;
      }
    }

    for (const child of n.namedChildren) {
      traverse(child);
    }
  }

  traverse(node);
  return complexity;
}

export function calculateTextCyclomaticComplexity(code: string): number {
  let complexity = 1;
  const branchMatches = code.match(/\b(if|for|while|catch|case|elif)\b|(&&|\|\||\?\?|\?(?!\.))/g);
  if (branchMatches) {
    complexity += branchMatches.length;
  }
  return complexity;
}

function makeSymbol(
  name: string,
  kind: SymbolKind,
  filePath: string,
  node: AstNode,
  exported: boolean,
  parentSymbol: string | null,
): SymbolInfo {
  let cyclomaticComplexity: number | undefined;
  if (kind === 'function' || kind === 'method') {
    cyclomaticComplexity = calculateAstCyclomaticComplexity(node);
  }

  const signature = extractDeepSignature(node, kind);

  return {
    name,
    kind,
    filePath,
    line: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    column: node.startPosition.column,
    exported,
    signature,
    parentSymbol: parentSymbol ?? undefined,
    cyclomaticComplexity,
  };
}

function extractDeepSignature(node: AstNode, kind: SymbolKind): string {
  try {
    const jsdoc = extractLeadingJSDoc(node);

    let sig = '';

    switch (kind) {
      case 'function':
      case 'method':
        sig = extractFunctionSignature(node);
        break;
      case 'class':
        sig = extractClassSignature(node);
        break;
      case 'interface':
        sig = extractInterfaceSignature(node);
        break;
      case 'type':
        sig = extractTypeAliasSignature(node);
        break;
      case 'enum':
        sig = extractEnumSignature(node);
        break;
      default: {
        const firstLine = node.text.split('\n')[0] ?? '';
        sig = firstLine.length > 200 ? firstLine.slice(0, 200) + '...' : firstLine;
        break;
      }
    }

    if (jsdoc && sig) {
      return jsdoc + '\n' + sig;
    }
    return sig || node.text.split('\n')[0]?.slice(0, 200) || '';
  } catch {
    const firstLine = node.text.split('\n')[0] ?? '';
    return firstLine.length > 200 ? firstLine.slice(0, 200) + '...' : firstLine;
  }
}

function extractLeadingJSDoc(node: AstNode): string {
  const parent = node.parent;
  if (!parent) return '';

  const siblings = parent.children;
  const myIndex = siblings.findIndex(
    (s) =>
      s.startPosition.row === node.startPosition.row &&
      s.startPosition.column === node.startPosition.column,
  );

  if (myIndex > 0) {
    const prev = siblings[myIndex - 1]!;
    if (prev.type === 'comment' && prev.text.startsWith('/**')) {
      const lines = prev.text.split('\n');
      if (lines.length <= 5) {
        return prev.text;
      }
      return lines.slice(0, 4).join('\n') + '\n */';
    }
  }
  return '';
}

function extractFunctionSignature(node: AstNode): string {
  const parts: string[] = [];

  const text = node.text;
  const firstLine = text.split('\n')[0] ?? '';

  if (firstLine.includes('async ')) parts.push('async');
  if (firstLine.includes('static ')) parts.push('static');

  const nameNode = node.childForFieldName('name');
  const paramsNode = node.childForFieldName('parameters');
  const returnTypeNode = node.childForFieldName('return_type');
  const typeParamsNode = node.childForFieldName('type_parameters');

  if (node.type === 'arrow_function' || node.type === 'function') {
    const params = paramsNode?.text ?? '()';
    const retType = returnTypeNode?.text ?? '';
    const generics = typeParamsNode?.text ?? '';
    parts.push(`${generics}${params}${retType ? ': ' + retType.replace(/^:\s*/, '') : ''} => ...`);
  } else {
    const name = nameNode?.text ?? '';
    const generics = typeParamsNode?.text ?? '';
    const params = paramsNode?.text ?? '()';
    const retType = returnTypeNode?.text ?? '';

    parts.push(
      `function ${name}${generics}${params}${retType ? ': ' + retType.replace(/^:\s*/, '') : ''}`,
    );
  }

  const sig = parts.join(' ');
  return sig.length > 300 ? sig.slice(0, 300) + '...' : sig;
}

function extractClassSignature(node: AstNode): string {
  const name = node.childForFieldName('name')?.text ?? '';
  const typeParams = node.childForFieldName('type_parameters')?.text ?? '';

  const heritageparts: string[] = [];
  for (const child of node.namedChildren) {
    if (child.type === 'class_heritage') {
      heritageparts.push(child.text);
    }
    if (child.type === 'extends_clause' || child.type === 'extends_type_clause') {
      heritageparts.push('extends ' + child.text.replace(/^extends\s*/, ''));
    }
    if (child.type === 'implements_clause') {
      heritageparts.push('implements ' + child.text.replace(/^implements\s*/, ''));
    }
  }

  const heritage = heritageparts.length > 0 ? ' ' + heritageparts.join(' ') : '';
  const sig = `class ${name}${typeParams}${heritage}`;
  return sig.length > 300 ? sig.slice(0, 300) + '...' : sig;
}

function extractInterfaceSignature(node: AstNode): string {
  const name = node.childForFieldName('name')?.text ?? '';
  const typeParams = node.childForFieldName('type_parameters')?.text ?? '';

  let extendsClause = '';
  for (const child of node.namedChildren) {
    if (child.type === 'extends_type_clause' || child.type === 'extends_clause') {
      extendsClause = ' ' + child.text;
      break;
    }
  }

  const sig = `interface ${name}${typeParams}${extendsClause}`;
  return sig.length > 300 ? sig.slice(0, 300) + '...' : sig;
}

function extractTypeAliasSignature(node: AstNode): string {
  const firstLine = node.text.split('\n')[0] ?? '';
  const sig = firstLine.replace(/\s*=\s*$/, '').trim();
  return sig.length > 300 ? sig.slice(0, 300) + '...' : sig;
}

function extractEnumSignature(node: AstNode): string {
  const name = node.childForFieldName('name')?.text ?? '';

  const body = node.childForFieldName('body');
  const members: string[] = [];
  if (body) {
    for (const member of body.namedChildren) {
      if (members.length >= 8) {
        members.push('...');
        break;
      }
      const mName = member.childForFieldName('name')?.text ?? member.text.split(/[=,\s]/)[0];
      if (mName) members.push(mName.trim());
    }
  }

  const memberList = members.length > 0 ? ` { ${members.join(', ')} }` : '';
  const sig = `enum ${name}${memberList}`;
  return sig.length > 300 ? sig.slice(0, 300) + '...' : sig;
}

function isExportedNode(node: AstNode): boolean {
  return node.parent?.type === 'export_statement';
}

function isConstant(text: string): boolean {
  return text.trimStart().startsWith('const');
}

function isBlockNode(type: string): boolean {
  return (
    type === 'statement_block' ||
    type === 'class_body' ||
    type === 'switch_body' ||
    type === 'block'
  );
}

function extractCSharpSymbolsAndImports(
  content: string,
  filePath: string,
  symbols: SymbolInfo[],
  imports: ImportInfo[],
  exportedNames: string[],
): void {
  const lines = content.split('\n');
  let currentClass: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

    const usingMatch = line.match(/^using\s+([\w.]+);/);
    if (usingMatch && usingMatch[1]) {
      imports.push({
        filePath,
        importPath: usingMatch[1],
        symbols: [usingMatch[1]],
        isDefault: false,
        isNamespace: true,
        isType: false,
      });
      continue;
    }

    const typeMatch = line.match(
      /(?:public|private|protected|internal|static|abstract|sealed|\s)*\b(class|interface|struct|enum)\s+([A-Za-z0-9_]+)/,
    );
    if (typeMatch && typeMatch[1] && typeMatch[2]) {
      const kind = typeMatch[1] as SymbolKind;
      const name = typeMatch[2];
      const isPublic = line.includes('public');
      currentClass = name;
      symbols.push({
        name,
        kind,
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isPublic,
        signature: line,
      });
      if (isPublic) exportedNames.push(name);
      continue;
    }

    const methodMatch = line.match(
      /(?:(?:public|private|protected|internal|static|async|virtual|override|abstract|sealed)\s+)+([\w<>[\]?]+)\s+([A-Za-z0-9_]+)\s*\([^;{}]*\)/,
    );
    if (methodMatch && methodMatch[2]) {
      const name = methodMatch[2];
      if (
        !['if', 'for', 'while', 'switch', 'catch', 'lock', 'using', 'get', 'set'].includes(name)
      ) {
        const isPublic = line.includes('public');
        symbols.push({
          name,
          kind: currentClass ? 'method' : 'function',
          filePath,
          line: i + 1,
          column: rawLine.indexOf(name),
          exported: isPublic,
          signature: line,
          parentSymbol: currentClass ?? undefined,
        });
        if (isPublic) exportedNames.push(name);
      }
    }
  }
}

function extractCppSymbolsAndImports(
  content: string,
  filePath: string,
  symbols: SymbolInfo[],
  imports: ImportInfo[],
  exportedNames: string[],
): void {
  const lines = content.split('\n');
  let currentScope: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

    const incMatch = line.match(/^#include\s*[<"]([^>"]+)[>"]/);
    if (incMatch && incMatch[1]) {
      imports.push({
        filePath,
        importPath: incMatch[1],
        symbols: [incMatch[1]],
        isDefault: false,
        isNamespace: false,
        isType: false,
      });
      continue;
    }

    const typeMatch = line.match(/\b(class|struct|enum(?:\s+class)?)\s+([A-Za-z0-9_]+)/);
    if (typeMatch && typeMatch[1] && typeMatch[2]) {
      const kind = typeMatch[1].startsWith('enum') ? 'enum' : (typeMatch[1] as SymbolKind);
      const name = typeMatch[2];
      currentScope = name;
      symbols.push({
        name,
        kind,
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: true,
        signature: line,
      });
      exportedNames.push(name);
      continue;
    }

    const funcMatch = line.match(
      /(?:[\w:*&<>]+\s+)+([A-Za-z0-9_]+)\s*\([^;{}]*\)\s*(?:const)?\s*\{/,
    );
    if (funcMatch && funcMatch[1]) {
      const name = funcMatch[1];
      if (!['if', 'for', 'while', 'switch', 'catch'].includes(name)) {
        symbols.push({
          name,
          kind: currentScope ? 'method' : 'function',
          filePath,
          line: i + 1,
          column: rawLine.indexOf(name),
          exported: true,
          signature: line,
          parentSymbol: currentScope ?? undefined,
        });
        exportedNames.push(name);
      }
    }
  }
}

function extractJavaSymbolsAndImports(
  content: string,
  filePath: string,
  symbols: SymbolInfo[],
  imports: ImportInfo[],
  exportedNames: string[],
): void {
  const lines = content.split('\n');
  let currentClass: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

    const impMatch = line.match(/^import\s+(?:static\s+)?([\w.*]+);/);
    if (impMatch && impMatch[1]) {
      imports.push({
        filePath,
        importPath: impMatch[1],
        symbols: [impMatch[1].split('.').pop() ?? impMatch[1]],
        isDefault: false,
        isNamespace: impMatch[1].endsWith('.*'),
        isType: true,
      });
      continue;
    }

    const typeMatch = line.match(
      /(?:public|protected|private|abstract|static|final|\s)*\b(class|interface|enum)\s+([A-Za-z0-9_]+)/,
    );
    if (typeMatch && typeMatch[1] && typeMatch[2]) {
      const kind = typeMatch[1] as SymbolKind;
      const name = typeMatch[2];
      const isPublic = line.includes('public');
      currentClass = name;
      symbols.push({
        name,
        kind,
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isPublic,
        signature: line,
      });
      if (isPublic) exportedNames.push(name);
      continue;
    }

    const methodMatch = line.match(
      /(?:public|protected|private|static|final|abstract|synchronized|\s)+([\w<>[\]]+)\s+([A-Za-z0-9_]+)\s*\([^;{}]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/,
    );
    if (methodMatch && methodMatch[2]) {
      const name = methodMatch[2];
      if (!['if', 'for', 'while', 'switch', 'catch'].includes(name)) {
        const isPublic = line.includes('public');
        symbols.push({
          name,
          kind: currentClass ? 'method' : 'function',
          filePath,
          line: i + 1,
          column: rawLine.indexOf(name),
          exported: isPublic,
          signature: line,
          parentSymbol: currentClass ?? undefined,
        });
        if (isPublic) exportedNames.push(name);
      }
    }
  }
}

function extractRubySymbolsAndImports(
  content: string,
  filePath: string,
  symbols: SymbolInfo[],
  imports: ImportInfo[],
  exportedNames: string[],
): void {
  const lines = content.split('\n');
  let currentScope: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const reqMatch = line.match(/^(?:require|require_relative|load)\s+['"]([^'"]+)['"]/);
    if (reqMatch && reqMatch[1]) {
      imports.push({
        filePath,
        importPath: reqMatch[1],
        symbols: [reqMatch[1]],
        isDefault: false,
        isNamespace: false,
        isType: false,
      });
      continue;
    }

    const classMatch = line.match(/^(?:class|module)\s+([A-Z][A-Za-z0-9_:]*)/);
    if (classMatch && classMatch[1]) {
      const name = classMatch[1];
      currentScope = name;
      symbols.push({
        name,
        kind: 'class',
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: true,
        signature: line,
      });
      exportedNames.push(name);
      continue;
    }

    const defMatch = line.match(/^def\s+([A-Za-z0-9_!?.]+)/);
    if (defMatch && defMatch[1]) {
      const name = defMatch[1];
      symbols.push({
        name,
        kind: currentScope ? 'method' : 'function',
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: true,
        signature: line,
        parentSymbol: currentScope ?? undefined,
      });
      exportedNames.push(name);
    }
  }
}

function extractKotlinSymbolsAndImports(
  content: string,
  filePath: string,
  symbols: SymbolInfo[],
  imports: ImportInfo[],
  exportedNames: string[],
): void {
  const lines = content.split('\n');
  let currentClass: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

    const impMatch = line.match(/^import\s+([\w.*]+)/);
    if (impMatch && impMatch[1]) {
      imports.push({
        filePath,
        importPath: impMatch[1],
        symbols: [impMatch[1].split('.').pop() ?? impMatch[1]],
        isDefault: false,
        isNamespace: impMatch[1].endsWith('.*'),
        isType: true,
      });
      continue;
    }

    const typeMatch = line.match(
      /(?:open|data|sealed|abstract|internal|public|private|\s)*\b(class|interface|object|enum\s+class)\s+([A-Za-z0-9_]+)/,
    );
    if (typeMatch && typeMatch[1] && typeMatch[2]) {
      const name = typeMatch[2];
      const kind = typeMatch[1].includes('interface') ? 'interface' : 'class';
      const isPublic = !line.includes('private');
      currentClass = name;
      symbols.push({
        name,
        kind,
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isPublic,
        signature: line,
      });
      if (isPublic) exportedNames.push(name);
      continue;
    }

    const funMatch = line.match(
      /(?:suspend|override|inline|internal|public|private|\s)*\bfun\s+(?:<[^>]+>\s+)?([A-Za-z0-9_]+)\s*\(/,
    );
    if (funMatch && funMatch[1]) {
      const name = funMatch[1];
      const isPublic = !line.includes('private');
      symbols.push({
        name,
        kind: currentClass ? 'method' : 'function',
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isPublic,
        signature: line,
        parentSymbol: currentClass ?? undefined,
      });
      if (isPublic) exportedNames.push(name);
    }
  }
}

function extractSwiftSymbolsAndImports(
  content: string,
  filePath: string,
  symbols: SymbolInfo[],
  imports: ImportInfo[],
  exportedNames: string[],
): void {
  const lines = content.split('\n');
  let currentScope: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

    const impMatch = line.match(/^import\s+([A-Za-z0-9_]+)/);
    if (impMatch && impMatch[1]) {
      imports.push({
        filePath,
        importPath: impMatch[1],
        symbols: [impMatch[1]],
        isDefault: false,
        isNamespace: true,
        isType: false,
      });
      continue;
    }

    const typeMatch = line.match(
      /(?:public|open|final|internal|fileprivate|private|\s)*\b(class|struct|protocol|enum)\s+([A-Za-z0-9_]+)/,
    );
    if (typeMatch && typeMatch[1] && typeMatch[2]) {
      const kind =
        typeMatch[1] === 'protocol'
          ? 'trait'
          : typeMatch[1] === 'struct'
            ? 'struct'
            : typeMatch[1] === 'enum'
              ? 'enum'
              : 'class';
      const name = typeMatch[2];
      const isPublic = line.includes('public') || line.includes('open');
      currentScope = name;
      symbols.push({
        name,
        kind,
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isPublic,
        signature: line,
      });
      if (isPublic) exportedNames.push(name);
      continue;
    }

    const funcMatch = line.match(
      /(?:public|private|fileprivate|open|static|class|mutating|\s)*\bfunc\s+([A-Za-z0-9_]+)\s*\(/,
    );
    if (funcMatch && funcMatch[1]) {
      const name = funcMatch[1];
      const isPublic = line.includes('public') || line.includes('open');
      symbols.push({
        name,
        kind: currentScope ? 'method' : 'function',
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isPublic,
        signature: line,
        parentSymbol: currentScope ?? undefined,
      });
      if (isPublic) exportedNames.push(name);
    }
  }
}

function extractPhpSymbolsTreeSitter(
  node: AstNode,
  filePath: string,
  symbols: SymbolInfo[],
  exportedNames: string[],
  parentName: string | null,
): void {
  for (const child of node.namedChildren) {
    switch (child.type) {
      case 'function_definition': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          const isExported = !name.startsWith('_');
          symbols.push(makeSymbol(name, 'function', filePath, child, isExported, parentName));
          if (isExported && !parentName) exportedNames.push(name);
        }
        break;
      }
      case 'class_declaration':
      case 'interface_declaration':
      case 'trait_declaration':
      case 'enum_declaration': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          const kind: SymbolKind =
            child.type === 'interface_declaration'
              ? 'interface'
              : child.type === 'trait_declaration'
                ? 'trait'
                : child.type === 'enum_declaration'
                  ? 'enum'
                  : 'class';
          symbols.push(makeSymbol(name, kind, filePath, child, true, parentName));
          exportedNames.push(name);

          const body =
            child.childForFieldName('body') ??
            child.namedChildren.find((c) => c.type === 'declaration_list');
          if (body) {
            extractPhpClassMembersTreeSitter(body, filePath, symbols, name);
          }
        }
        break;
      }
      default:
        if (child.namedChildren.length > 0 && !isBlockNode(child.type)) {
          extractPhpSymbolsTreeSitter(child, filePath, symbols, exportedNames, parentName);
        }
        break;
    }
  }
}

function extractPhpClassMembersTreeSitter(
  bodyNode: AstNode,
  filePath: string,
  symbols: SymbolInfo[],
  className: string,
): void {
  for (const member of bodyNode.namedChildren) {
    if (member.type === 'method_declaration') {
      const name = member.childForFieldName('name')?.text ?? '';
      if (name) {
        const isPublic = !member.text.includes('private') && !member.text.includes('protected');
        symbols.push(makeSymbol(name, 'method', filePath, member, isPublic, className));
      }
    }
  }
}

function extractPhpImportsTreeSitter(node: AstNode, filePath: string, imports: ImportInfo[]): void {
  for (const child of node.namedChildren) {
    if (child.type === 'namespace_use_declaration') {
      for (const clause of child.namedChildren) {
        if (clause.type === 'namespace_use_clause') {
          const pathText = clause.text.replace(/;$/, '').trim();
          const parts = pathText.split('\\');
          const symbolName = parts[parts.length - 1] ?? pathText;
          imports.push({
            filePath,
            importPath: pathText,
            symbols: [symbolName],
            isDefault: false,
            isNamespace: false,
            isType: false,
          });
        }
      }
    } else if (child.namedChildren.length > 0) {
      extractPhpImportsTreeSitter(child, filePath, imports);
    }
  }
}

function extractPhpSymbolsAndImports(
  content: string,
  filePath: string,
  symbols: SymbolInfo[],
  imports: ImportInfo[],
  exportedNames: string[],
): void {
  const lines = content.split('\n');
  let currentClass: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (
      !line ||
      line.startsWith('//') ||
      line.startsWith('#') ||
      line.startsWith('/*') ||
      line.startsWith('*')
    ) {
      continue;
    }

    const useMatch = line.match(
      /^use\s+(?:function\s+|const\s+)?([A-Za-z0-9_\\]+)(?:\s+as\s+([A-Za-z0-9_]+))?;/,
    );
    if (useMatch && useMatch[1]) {
      const fullPath = useMatch[1];
      const alias = useMatch[2];
      const symbolName = alias || fullPath.split('\\').pop() || fullPath;
      imports.push({
        filePath,
        importPath: fullPath,
        symbols: [symbolName],
        isDefault: false,
        isNamespace: false,
        isType: false,
      });
      continue;
    }

    const reqMatch = line.match(
      /^(?:require|require_once|include|include_once)\s*\(?\s*['"]([^'"]+)['"]\s*\)?;/,
    );
    if (reqMatch && reqMatch[1]) {
      imports.push({
        filePath,
        importPath: reqMatch[1],
        symbols: [reqMatch[1]],
        isDefault: true,
        isNamespace: false,
        isType: false,
      });
      continue;
    }

    const typeMatch = line.match(
      /(?:abstract|final|readonly|\s)*\b(class|interface|trait|enum)\s+([A-Za-z0-9_]+)/,
    );
    if (typeMatch && typeMatch[1] && typeMatch[2]) {
      const rawKind = typeMatch[1];
      const kind: SymbolKind =
        rawKind === 'trait'
          ? 'trait'
          : rawKind === 'enum'
            ? 'enum'
            : rawKind === 'interface'
              ? 'interface'
              : 'class';
      const name = typeMatch[2];
      currentClass = name;
      symbols.push({
        name,
        kind,
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: true,
        signature: line,
      });
      exportedNames.push(name);
      continue;
    }

    const funcMatch = line.match(
      /(?:public|protected|private|static|final|abstract|\s)*\bfunction\s+(?:&\s*)?([A-Za-z0-9_]+)\s*\(/,
    );
    if (funcMatch && funcMatch[1]) {
      const name = funcMatch[1];
      const isPublic = !line.includes('private') && !line.includes('protected');
      symbols.push({
        name,
        kind: currentClass ? 'method' : 'function',
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isPublic,
        signature: line,
        parentSymbol: currentClass ?? undefined,
      });
      if (isPublic) exportedNames.push(name);
    }
  }
}

function extractTypeScriptSymbolsAndImportsRegex(
  content: string,
  filePath: string,
  symbols: SymbolInfo[],
  imports: ImportInfo[],
  exportedNames: string[],
): void {
  const lines = content.split('\n');
  let currentClass: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      continue;
    }

    const importNamedMatch = line.match(
      /^import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/,
    );
    const importMatch = line.match(
      /^import\s+(?:type\s+)?(?:([^{}\n]+)\s+from\s+)?['"]([^'"]+)['"]/,
    );
    if (importNamedMatch && importNamedMatch[1] && importNamedMatch[2]) {
      const symbolsList = importNamedMatch[1]
        .split(',')
        .map((s) =>
          s
            .trim()
            .split(/\s+as\s+/)[0]
            ?.trim(),
        )
        .filter((s): s is string => Boolean(s));
      imports.push({
        filePath,
        importPath: importNamedMatch[2],
        symbols: symbolsList,
        isDefault: false,
        isNamespace: false,
        isType: line.includes('import type'),
      });
      continue;
    } else if (importMatch && importMatch[2]) {
      const defaultName = importMatch[1]?.trim();
      imports.push({
        filePath,
        importPath: importMatch[2],
        symbols: defaultName ? [defaultName] : [],
        isDefault: Boolean(defaultName && !defaultName.startsWith('*')),
        isNamespace: Boolean(defaultName && defaultName.startsWith('*')),
        isType: line.includes('import type'),
      });
      continue;
    }

    const requireMatch = line.match(
      /(?:const|let|var)\s+(?:\{([^}]+)\}|([A-Za-z0-9_$]+))\s*=\s*require\(['"]([^'"]+)['"]\)/,
    );
    if (requireMatch && requireMatch[3]) {
      const isDestructured = Boolean(requireMatch[1]);
      const syms = isDestructured
        ? requireMatch[1]!
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : requireMatch[2]
          ? [requireMatch[2]]
          : [];
      imports.push({
        filePath,
        importPath: requireMatch[3],
        symbols: syms,
        isDefault: !isDestructured,
        isNamespace: false,
        isType: false,
      });
      continue;
    }

    const typeMatch = line.match(
      /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?(?:declare\s+)?(class|interface|type|enum)\s+([A-Za-z0-9_$]+)/,
    );
    if (typeMatch && typeMatch[1] && typeMatch[2]) {
      const rawKind = typeMatch[1];
      let kind: SymbolKind =
        rawKind === 'class'
          ? 'class'
          : rawKind === 'interface'
            ? 'interface'
            : rawKind === 'enum'
              ? 'enum'
              : 'type';
      const name = typeMatch[2];
      const isExported = line.startsWith('export');

      if (rawKind === 'class') {
        const prevLine = i > 0 ? (lines[i - 1] ?? '') : '';
        const combined = `${prevLine}\n${line}`;
        if (/@Controller\s*(?:\(|$)/.test(combined)) {
          kind = 'controller';
        } else if (/@Injectable\s*(?:\(|$)|@Service\s*(?:\(|$)/.test(combined)) {
          kind = 'provider';
        } else if (/@Module\s*(?:\(|$)/.test(combined)) {
          kind = 'module';
        }
      }

      currentClass =
        kind === 'class' || kind === 'controller' || kind === 'provider' || kind === 'module'
          ? name
          : currentClass;
      symbols.push({
        name,
        kind,
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isExported,
        signature: line,
      });
      if (isExported) exportedNames.push(name);
      continue;
    }

    const funcMatch = line.match(
      /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)\s*(?:<[^>]*>)?\s*\(/,
    );
    if (funcMatch && funcMatch[1]) {
      const name = funcMatch[1];
      const isExported = line.startsWith('export');
      let kind: SymbolKind = currentClass ? 'method' : 'function';
      if (!currentClass) {
        const nextKind = resolveNextJsRouteSymbolKind(filePath, name, isExported);
        if (nextKind) {
          kind = nextKind;
        } else if (isReactHookName(name)) {
          kind = 'hook';
        }
      }
      symbols.push({
        name,
        kind,
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isExported,
        signature: line,
        parentSymbol: currentClass ?? undefined,
      });
      if (isExported) exportedNames.push(name);
      continue;
    }

    const varMatch = line.match(
      /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)(?:\s*:\s*[^=]+)?\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/,
    );
    if (varMatch && varMatch[1]) {
      const name = varMatch[1];
      const isExported = line.startsWith('export');
      let kind: SymbolKind = 'function';
      const nextKind = resolveNextJsRouteSymbolKind(filePath, name, isExported);
      if (nextKind) {
        kind = nextKind;
      } else if (isReactHookName(name)) {
        kind = 'hook';
      }
      symbols.push({
        name,
        kind,
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isExported,
        signature: line,
      });
      if (isExported) exportedNames.push(name);
      continue;
    }

    const constMatch = line.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)/);
    if (constMatch && constMatch[1]) {
      const name = constMatch[1];
      const isExported = line.startsWith('export');
      symbols.push({
        name,
        kind: 'constant',
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isExported,
        signature: line,
      });
      if (isExported) exportedNames.push(name);
    }
  }
}

function extractPythonSymbolsAndImportsRegex(
  content: string,
  filePath: string,
  symbols: SymbolInfo[],
  imports: ImportInfo[],
  exportedNames: string[],
): void {
  const lines = content.split('\n');
  let currentClass: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const fromMatch = line.match(/^from\s+([A-Za-z0-9_.]+)\s+import\s+([^#]+)/);
    if (fromMatch && fromMatch[1] && fromMatch[2]) {
      const syms = fromMatch[2]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      imports.push({
        filePath,
        importPath: fromMatch[1],
        symbols: syms,
        isDefault: false,
        isNamespace: syms.includes('*'),
        isType: false,
      });
      continue;
    }

    const impMatch = line.match(/^import\s+([A-Za-z0-9_.]+)/);
    if (impMatch && impMatch[1]) {
      imports.push({
        filePath,
        importPath: impMatch[1],
        symbols: [impMatch[1]],
        isDefault: true,
        isNamespace: false,
        isType: false,
      });
      continue;
    }

    const classMatch = line.match(/^class\s+([A-Za-z0-9_]+)/);
    if (classMatch && classMatch[1]) {
      const name = classMatch[1];
      const isExported = !name.startsWith('_');
      currentClass = name;
      symbols.push({
        name,
        kind: 'class',
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isExported,
        signature: line,
      });
      if (isExported) exportedNames.push(name);
      continue;
    }

    const defMatch = line.match(/^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/);
    if (defMatch && defMatch[1]) {
      const name = defMatch[1];
      const isExported = !name.startsWith('_');
      const isMethod = Boolean(
        currentClass && (rawLine.startsWith('    ') || rawLine.startsWith('\t')),
      );
      symbols.push({
        name,
        kind: isMethod ? 'method' : 'function',
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isExported,
        signature: line,
        parentSymbol: isMethod ? (currentClass ?? undefined) : undefined,
      });
      if (isExported && !isMethod) exportedNames.push(name);
    }
  }
}

function extractGoSymbolsAndImportsRegex(
  content: string,
  filePath: string,
  symbols: SymbolInfo[],
  imports: ImportInfo[],
  exportedNames: string[],
): void {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;

    const impMatch = line.match(/^import\s+['"]([^'"]+)['"]/);
    if (impMatch && impMatch[1]) {
      imports.push({
        filePath,
        importPath: impMatch[1],
        symbols: [impMatch[1].split('/').pop() || impMatch[1]],
        isDefault: false,
        isNamespace: false,
        isType: false,
      });
      continue;
    }

    const typeMatch = line.match(/^type\s+([A-Za-z0-9_]+)\s+(struct|interface)/);
    if (typeMatch && typeMatch[1] && typeMatch[2]) {
      const name = typeMatch[1];
      const isExported = /^[A-Z]/.test(name);
      symbols.push({
        name,
        kind: typeMatch[2] === 'interface' ? 'interface' : 'struct',
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isExported,
        signature: line,
      });
      if (isExported) exportedNames.push(name);
      continue;
    }

    const funcMatch = line.match(/^func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(/);
    if (funcMatch && funcMatch[1]) {
      const name = funcMatch[1];
      const isExported = /^[A-Z]/.test(name);
      symbols.push({
        name,
        kind: line.includes('func (') ? 'method' : 'function',
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isExported,
        signature: line,
      });
      if (isExported) exportedNames.push(name);
    }
  }
}

function extractRustSymbolsAndImportsRegex(
  content: string,
  filePath: string,
  symbols: SymbolInfo[],
  imports: ImportInfo[],
  exportedNames: string[],
): void {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;

    const useMatch = line.match(/^pub(?:\([^)]+\))?\s+use\s+([^;]+);|^use\s+([^;]+);/);
    if (useMatch) {
      const usePath = (useMatch[1] || useMatch[2] || '').trim();
      imports.push({
        filePath,
        importPath: usePath,
        symbols: [usePath.split('::').pop() || usePath],
        isDefault: false,
        isNamespace: usePath.endsWith('*'),
        isType: false,
      });
      continue;
    }

    const typeMatch = line.match(/^(?:pub(?:\([^)]+\))?\s+)?(struct|enum|trait)\s+([A-Za-z0-9_]+)/);
    if (typeMatch && typeMatch[1] && typeMatch[2]) {
      const name = typeMatch[2];
      const kind: SymbolKind =
        typeMatch[1] === 'struct' ? 'struct' : typeMatch[1] === 'enum' ? 'enum' : 'trait';
      const isExported = line.startsWith('pub');
      symbols.push({
        name,
        kind,
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isExported,
        signature: line,
      });
      if (isExported) exportedNames.push(name);
      continue;
    }

    const fnMatch = line.match(
      /^(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)\s*(?:<[^>]*>)?\s*\(/,
    );
    if (fnMatch && fnMatch[1]) {
      const name = fnMatch[1];
      const isExported = line.startsWith('pub');
      symbols.push({
        name,
        kind: 'function',
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: isExported,
        signature: line,
      });
      if (isExported) exportedNames.push(name);
    }
  }
}

export function validateSourceCode(
  code: string,
  language: Language,
): { valid: boolean; errors: string[] } {
  try {
    const Parser = getParserClass();
    const grammar = getLanguage(language);

    if (!grammar) {
      return { valid: true, errors: [] };
    }

    const parser = new Parser();
    parser.setLanguage(grammar);
    const tree = parser.parse(code);

    const errors: string[] = [];
    if (tree.rootNode && tree.rootNode.hasError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const findErrors = (node: any) => {
        if (node.type === 'ERROR' || node.isMissing()) {
          const row = node.startPosition?.row ?? 0;
          const col = node.startPosition?.column ?? 0;
          const token = code.slice(node.startIndex, node.endIndex).trim();
          errors.push(
            `Syntax error at line ${row + 1}, column ${col}: unexpected token '${token}'`,
          );
        }
        for (let i = 0; i < (node.childCount || 0); i++) {
          const child = node.child(i);
          if (child && child.hasError) {
            findErrors(child);
          }
        }
      };
      findErrors(tree.rootNode);
    }

    return {
      valid: errors.length === 0,
      errors: errors.slice(0, 10),
    };
  } catch (err) {
    return {
      valid: false,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}

function extractPrismaSymbolsAndImports(
  content: string,
  filePath: string,
  symbols: SymbolInfo[],
  imports: ImportInfo[],
  exportedNames: string[],
): void {
  const lines = content.split('\n');
  let currentModel: string | null = null;
  const models = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    const modelMatch = trimmed.match(/^model\s+([A-Za-z0-9_]+)/);
    if (modelMatch && modelMatch[1]) {
      models.add(modelMatch[1]);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;

    const modelMatch = line.match(/^model\s+([A-Za-z0-9_]+)\s*\{/);
    if (modelMatch && modelMatch[1]) {
      const name = modelMatch[1];
      currentModel = name;
      symbols.push({
        name,
        kind: 'model',
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: true,
        signature: `model ${name}`,
      });
      exportedNames.push(name);
      continue;
    }

    const enumMatch = line.match(/^enum\s+([A-Za-z0-9_]+)\s*\{/);
    if (enumMatch && enumMatch[1]) {
      const name = enumMatch[1];
      currentModel = null;
      symbols.push({
        name,
        kind: 'enum',
        filePath,
        line: i + 1,
        column: rawLine.indexOf(name),
        exported: true,
        signature: `enum ${name}`,
      });
      exportedNames.push(name);
      continue;
    }

    if (line === '}') {
      currentModel = null;
      continue;
    }

    if (currentModel) {
      const fieldMatch = line.match(/^([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)(\[\]|\?)?/);
      if (fieldMatch && fieldMatch[1] && fieldMatch[2]) {
        const fieldName = fieldMatch[1];
        const fieldType = fieldMatch[2];

        symbols.push({
          name: fieldName,
          kind: 'property',
          filePath,
          line: i + 1,
          column: rawLine.indexOf(fieldName),
          exported: false,
          signature: line,
          parentSymbol: currentModel,
        });

        if (models.has(fieldType) && fieldType !== currentModel) {
          imports.push({
            filePath,
            importPath: fieldType,
            symbols: [fieldType],
            isDefault: false,
            isNamespace: false,
            isType: true,
          });
        }
      }
    }
  }
}

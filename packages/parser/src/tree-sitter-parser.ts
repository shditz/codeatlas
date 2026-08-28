import { createRequire } from 'node:module';
import type { SymbolInfo, ImportInfo, SymbolKind, Language } from '@codeatlas/core';
import { createLogger } from '@codeatlas/shared';

const logger = createLogger('parser');
const nodeRequire = typeof require !== 'undefined' ? require : createRequire(import.meta.url);

let ParserClass: unknown = null;
const languageGrammars: Partial<Record<Language, unknown>> = {};

function getParserClass(): any {
  if (!ParserClass) {
    ParserClass = nodeRequire('tree-sitter');
  }
  return ParserClass;
}

function getLanguage(lang: Language): unknown {
  if (languageGrammars[lang]) {
    return languageGrammars[lang];
  }

  let grammar: unknown = null;
  switch (lang) {
    case 'typescript': {
      const mod = nodeRequire('tree-sitter-typescript');
      grammar = mod.typescript ?? mod.default ?? mod;
      break;
    }
    case 'javascript': {
      const mod = nodeRequire('tree-sitter-javascript');
      grammar = mod.default ?? mod;
      break;
    }
    case 'python': {
      const mod = nodeRequire('tree-sitter-python');
      grammar = mod.default ?? mod;
      break;
    }
    case 'go': {
      const mod = nodeRequire('tree-sitter-go');
      grammar = mod.default ?? mod;
      break;
    }
    case 'rust': {
      const mod = nodeRequire('tree-sitter-rust');
      grammar = mod.default ?? mod;
      break;
    }
    default:
      throw new Error(`Unsupported tree-sitter language: ${lang}`);
  }

  languageGrammars[lang] = grammar;
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
    const ParserConstructor = getParserClass();
    const lang = getLanguage(language);

    const parser = new ParserConstructor();
    parser.setLanguage(lang);

    const tree = parser.parse(content);
    const root = tree.rootNode as unknown as AstNode;

    switch (language) {
      case 'typescript':
      case 'javascript':
        extractTypeScriptSymbols(root, filePath, symbols, exportedNames, null);
        extractTypeScriptImports(root, filePath, imports);
        break;

      case 'python':
        extractPythonSymbols(root, filePath, symbols, exportedNames, null);
        extractPythonImports(root, filePath, imports);
        break;

      case 'go':
        extractGoSymbols(root, filePath, symbols, exportedNames, null);
        extractGoImports(root, filePath, imports);
        break;

      case 'rust':
        extractRustSymbols(root, filePath, symbols, exportedNames, null);
        extractRustImports(root, filePath, imports);
        break;

      default:
        break;
    }

    if (tree.rootNode.hasError) {
      errors.push(`Parse tree contains errors for ${filePath}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to parse ${filePath}: ${msg}`);
    logger.debug(`Parse error for ${filePath}: ${msg}`);
  }

  return { symbols, imports, exportedNames, errors };
}

/* ─────────────────────────────────────────────────────────────
 * TypeScript / JavaScript AST Extraction
 * ───────────────────────────────────────────────────────────── */

function extractTypeScriptSymbols(
  node: AstNode,
  filePath: string,
  symbols: SymbolInfo[],
  exportedNames: string[],
  parentName: string | null,
): void {
  for (const child of node.namedChildren) {
    const isExported = isExportedNode(child);

    switch (child.type) {
      case 'function_declaration':
      case 'generator_function_declaration': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          symbols.push(makeSymbol(name, 'function', filePath, child, isExported, parentName));
          if (isExported) exportedNames.push(name);
        }
        break;
      }

      case 'class_declaration': {
        const name = child.childForFieldName('name')?.text ?? '';
        if (name) {
          symbols.push(makeSymbol(name, 'class', filePath, child, isExported, parentName));
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
        extractTypeScriptSymbols(child, filePath, symbols, exportedNames, parentName);
        extractTypeScriptExportedNames(child, exportedNames);
        break;
      }

      default:
        if (child.namedChildren.length > 0 && !isBlockNode(child.type)) {
          extractTypeScriptSymbols(child, filePath, symbols, exportedNames, parentName);
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
      const kind: SymbolKind = isArrowFn
        ? 'function'
        : isConstant(node.text)
          ? 'constant'
          : 'variable';

      symbols.push(makeSymbol(name, kind, filePath, declarator, isExported, parentName));
      if (isExported) exportedNames.push(name);
    }
  }
}

function extractTypeScriptImports(
  node: AstNode,
  filePath: string,
  imports: ImportInfo[],
): void {
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

function extractTypeScriptExportedNames(
  node: AstNode,
  exportedNames: string[],
): void {
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

/* ─────────────────────────────────────────────────────────────
 * Python AST Extraction
 * ───────────────────────────────────────────────────────────── */

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

function extractPythonImports(
  node: AstNode,
  filePath: string,
  imports: ImportInfo[],
): void {
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

/* ─────────────────────────────────────────────────────────────
 * Go AST Extraction
 * ───────────────────────────────────────────────────────────── */

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

function extractGoImports(
  node: AstNode,
  filePath: string,
  imports: ImportInfo[],
): void {
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

/* ─────────────────────────────────────────────────────────────
 * Rust AST Extraction
 * ───────────────────────────────────────────────────────────── */

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

function extractRustImports(
  node: AstNode,
  filePath: string,
  imports: ImportInfo[],
): void {
  for (const child of node.namedChildren) {
    if (child.type === 'use_declaration') {
      const path = child.childForFieldName('argument')?.text ?? child.text.replace(/^pub\s+use\s+|use\s+|;$/g, '').trim();
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

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function makeSymbol(
  name: string,
  kind: SymbolKind,
  filePath: string,
  node: AstNode,
  exported: boolean,
  parentSymbol: string | null,
): SymbolInfo {
  const firstLine = node.text.split('\n')[0] ?? '';
  return {
    name,
    kind,
    filePath,
    line: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    column: node.startPosition.column,
    exported,
    signature: firstLine.length > 200 ? firstLine.slice(0, 200) + '...' : firstLine,
    parentSymbol: parentSymbol ?? undefined,
  };
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

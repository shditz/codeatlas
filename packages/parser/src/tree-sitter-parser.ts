import { createRequire } from 'node:module';
import type { SymbolInfo, ImportInfo, SymbolKind, Language } from '@codeatlas/core';
import { createLogger } from '@codeatlas/shared';

const logger = createLogger('parser');
const nodeRequire =
  typeof require !== 'undefined'
    ? require
    : createRequire(import.meta?.url ?? `file://${process.cwd()}/dummy.js`);

let ParserClass: unknown = null;
const languageGrammars: Partial<Record<Language, unknown>> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    if (['typescript', 'javascript', 'python', 'go', 'rust'].includes(language)) {
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
      }

      if (tree.rootNode.hasError) {
        errors.push(`Parse tree contains errors for ${filePath}`);
      }
    } else {
      switch (language) {
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
  const firstLine = node.text.split('\n')[0] ?? '';
  let cyclomaticComplexity: number | undefined;
  if (kind === 'function' || kind === 'method') {
    cyclomaticComplexity = calculateAstCyclomaticComplexity(node);
  }

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
    cyclomaticComplexity,
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

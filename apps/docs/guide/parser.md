# AST Parser Pipeline

The `@codeatlas-ai/parser` package is responsible for parsing arbitrary source code into structured syntactic metadata and dependency relationships.

---

## Supported Language Grammars

CodeAtlas provides native Tree-sitter bindings for the following languages:

| Language             | Extension Patterns            | Parsed Entity Types                                                           |
| -------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| **TypeScript / TSX** | `.ts`, `.tsx`, `.mts`         | Classes, Interfaces, Enums, Type Aliases, Functions, Imports, Exports         |
| **JavaScript / JSX** | `.js`, `.jsx`, `.mjs`, `.cjs` | Classes, Functions, Variables, CommonJS require, ES Imports                   |
| **Python**           | `.py`                         | Classes, Methods, Functions, Module Imports (`from x import y`)               |
| **PHP**              | `.php`                        | Classes, Traits, Interfaces, Functions, `use` statements, `include`/`require` |
| **Go**               | `.go`                         | Structs, Interfaces, Functions, Methods, Package Imports                      |
| **Rust**             | `.rs`                         | Structs, Traits, Enums, Functions, `use` declarations                         |
| **HTML / CSS**       | `.html`, `.css`, `.scss`      | Document structure, stylesheets, `@import` rules                              |

---

## Extraction Process

```typescript
import { createParser, parseSourceFile } from '@codeatlas-ai/parser';

const parser = createParser({ language: 'typescript' });
const result = await parseSourceFile(filePath, fileContent, parser);

console.log(result.symbols);
// [
//   { name: 'AuthService', kind: 'class', startLine: 12, endLine: 84 },
//   { name: 'validateToken', kind: 'method', startLine: 24, endLine: 36 }
// ]

console.log(result.dependencies);
// [
//   { source: 'authService.ts', target: './tokenUtil', kind: 'import' }
// ]
```

---

## Performance Optimizations

1. **Incremental SHA-256 Hashing**: Files whose cryptographic content hashes match stored records in SQLite are bypassed during re-indexing.
2. **Worker Pool Execution**: Parsing operations for large multi-thousand file repositories are dispatched across available CPU cores.
3. **Graceful Fault Tolerance**: Syntax errors or incomplete code snippets within active development files are captured without halting the indexing process.

# AST Parser & Semantic Resolution Pipeline

The `@codeatlas-ai/parser` package parses source code into structured AST symbols, extracts normalized dependency edges, resolves semantic type inheritance, and classifies framework-specific constructs.

---

## Supported Language Grammars & Frameworks

CodeAtlas provides native Tree-sitter bindings and semantic extraction for:

| Language / Framework | Extension Patterns            | Parsed Entity Types                                                                                   |
| :------------------- | :---------------------------- | :---------------------------------------------------------------------------------------------------- |
| **TypeScript / TSX** | `.ts`, `.tsx`, `.mts`, `.cts` | Classes, Interfaces, Enums, Type Aliases, Functions, React Hooks, Next.js Routes, `@/*` Path Mappings |
| **JavaScript / JSX** | `.js`, `.jsx`, `.mjs`, `.cjs` | Classes, Functions, Variables, CommonJS require, ES Imports, JSX components                           |
| **NestJS**           | `.ts`                         | Controllers (`@Controller`), Providers (`@Injectable`), Modules (`@Module`)                           |
| **Prisma Schema**    | `.prisma`                     | Models, Enums, Properties/Fields, Cross-Model Relational Graph Edges                                  |
| **Python**           | `.py`                         | Classes, Methods, Functions, Module Imports (`from x import y`)                                       |
| **PHP**              | `.php`, `.phtml`              | Classes, Traits, Interfaces, Functions, `use` statements, `include`/`require`                         |
| **Go**               | `.go`                         | Structs, Interfaces, Functions, Methods, Package Imports                                              |
| **Rust**             | `.rs`                         | Structs, Traits, Impl blocks, Enums, Functions, `use` declarations                                    |
| **C# / Java**        | `.cs`, `.java`                | Classes, Interfaces, Methods, Namespaces/Packages, Imports                                            |
| **C / C++**          | `.c`, `.cpp`, `.h`, `.hpp`    | Functions, Structs, Classes, Header Includes                                                          |
| **Data & Markup**    | `.json`, `.yaml`, `.toml`     | Schema validation and structural metadata                                                             |

---

## 🧩 Framework-Specific Semantic Adapters

### 1. React Custom Hooks

Functions starting with `use[A-Z0-9].*` (e.g., `useAuth`, `useLocalStorage`) are automatically recognized as `SymbolKind: 'hook'` instead of generic functions.

### 2. Next.js App Router

Files located under `app/**/` follow App Router conventions:

- `page.tsx` default exports are tagged as `SymbolKind: 'page'`.
- `layout.tsx` default exports are tagged as `SymbolKind: 'layout'`.
- `route.ts` HTTP method handlers (`GET`, `POST`, `PUT`, `DELETE`) are tagged as `SymbolKind: 'route_handler'`.

### 3. NestJS Dependency Injection

Class decorators are parsed to establish dependency injection relationships:

- `@Controller(...)` $\rightarrow$ `SymbolKind: 'controller'`
- `@Injectable(...)`, `@Service(...)`, `@Repository(...)` $\rightarrow$ `SymbolKind: 'provider'`
- `@Module(...)` $\rightarrow$ `SymbolKind: 'module'`

### 4. Prisma Schema

Parses `schema.prisma` files to extract database entity definitions (`SymbolKind: 'model'`) and connects cross-model relations as dependency edges in the graph database.

---

## 🧠 TypeScript Semantic Resolution Engine

In addition to syntax trees, CodeAtlas performs cross-file semantic analysis:

1. **Path Mapping Resolution**: Automatically resolves `tsconfig.json` `compilerOptions.paths` (e.g. `@/*` $\rightarrow$ `src/*`) to absolute file paths with confidence `1.0`.
2. **Type Inheritance & Implementation**:
   - Detects `class Foo extends Bar` and `class Foo implements IBaz`.
   - Creates semantic graph dependency edges (`kind: 'type_reference'`) linking derived classes directly to their base definitions.

---

## Performance Optimizations

1. **Incremental SHA-256 Hashing**: Files whose content hashes match stored records in SQLite are bypassed during re-indexing.
2. **Worker Pool Execution**: Parsing operations are batched across concurrent worker threads.
3. **Fault Tolerance**: Syntax errors or incomplete code snippets in active development files are captured gracefully without halting the indexing process.

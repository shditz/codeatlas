# 🧩 Core Concepts

Understanding how CodeAtlas works under the hood will help you get the most out of your AI coding assistants.

---

## 1. Abstract Syntax Tree (AST) & Semantic Resolution

Most search tools treat code as **flat text**—they simply search for literal keywords.

**CodeAtlas understands code as structure and semantics:**
Using [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) and TypeScript semantic resolvers:

- It recognizes `class UserService` as an architectural entity, not generic words.
- It tracks type inheritance (`extends`, `implements`) and path mappings (`@/*`).
- It extracts cyclomatic complexity, function signatures, and parameter contracts.

---

## 2. Framework-Specific Semantic Adapters

Real-world code follows framework conventions that go beyond language syntax:

- **React Custom Hooks**: Functions matching `use[A-Z0-9].*` are classified as `SymbolKind: 'hook'`.
- **Next.js App Router**: Understands `page.tsx`, `layout.tsx`, and `route.ts` as architectural endpoints.
- **NestJS Dependency Injection**: Decorators (`@Controller`, `@Injectable`, `@Module`) are parsed into DI graph relationships.
- **Prisma Schema**: Parses database models, enums, and cross-model relations into the graph.

---

## 3. True Architecture Model (DDD Layering)

CodeAtlas automatically categorizes codebase files into 5 Domain-Driven Design (DDD) layers:

1. **Presentation Layer**: Controllers, Routes, Handlers, Pages, Views, APIs.
2. **Application Layer**: Services, UseCases, Commands, Queries, Workflows.
3. **Domain Layer**: Entities, Aggregates, Models, Value Objects.
4. **Infrastructure Layer**: Repositories, Database Adapters, Storage, Network Clients.
5. **Shared Layer**: Utilities, Types, Config, Common Helpers.

Using `atlas analyze --architecture`, CodeAtlas flags architectural regressions (e.g. Presentation bypassing Services to call Repositories directly, or Domain depending on Infrastructure).

---

## 4. Automated Secret Redaction Layer

Developer privacy and security are enforced at the ingestion boundary:

- The built-in **`SecretScanner`** uses high-entropy regex patterns to scrub Private Keys, Cloud API keys (Anthropic, OpenAI, AWS, GCP, GitHub), JWTs, and database passwords.
- Content is sanitized *before* writing to SQLite FTS5 search tables and before returning MCP outputs to external LLMs.

---

## 5. Token Budgeting & AST Skeletons

LLMs charge per token and lose reasoning acuity when provided too much irrelevant text.

When you run `atlas context "task" --intent feature --budget 4000`:

1. CodeAtlas routes retrieval using task intent (`bug`, `feature`, `refactor`) across FTS5 and graph proximity.
2. Primary files are provided in full.
3. Secondary files are compressed into **AST Skeletons**—preserving class, method, and type signatures while stripping inner logic.
4. The AI receives 100% of the type and architectural context while saving up to 92% on token budgets!

---

## 6. Local-First & 100% Private

- **Zero Telemetry**: No cloud sync, external API calls, or tracking pings.
- **Embedded Storage**: All databases and indexes live inside the `.atlas/` folder in your project.
- **Offline Capable**: Works 100% offline on secure, air-gapped environments.

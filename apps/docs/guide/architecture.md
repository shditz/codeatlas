# System Architecture

CodeAtlas is organized as a decoupled, modular TypeScript monorepo operating under strict domain-driven boundaries and local-first execution principles.

---

## Monorepo Architecture

```
CodeAtlas/
├── packages/
│   ├── core/           Domain models, interfaces, language registry, SecretScanner
│   ├── parser/         Tree-sitter AST, TypeScript semantic resolver, Framework adapters
│   ├── storage/        SQLite persistent repository, migrations (1-5), and FTS5 search
│   ├── graph/          In-memory directed acyclic graph (DAG) and Cypher engine
│   ├── rules/          Evidence-based rule generator, conflict validator, prompt exporter
│   ├── compression/    AST skeletonizer and token budget compressor
│   ├── retrieval/      Task-intent BM25 and graph proximity retrieval engine
│   ├── ranking/        Multi-factor PageRank and temporal churn ranker
│   ├── analytics/      Architecture analyzer (DDD layers, regressions), dead code & taint
│   ├── git/            Git diff, temporal churn metrics, and commit tracker
│   └── mcp/            16 Model Context Protocol server tools implementation
└── apps/
    ├── cli/            Command-line application entry point (`atlas`)
    ├── vscode-extension/ Official Visual Studio Code & Cursor extension
    ├── webview/        React force-directed graph web application
    ├── mcp-server/     Standalone stdio MCP server executable
    └── docs/           VitePress documentation site
```

---

## 🏛️ True Architecture Model (DDD Layering)

CodeAtlas analyzes code structures against standard **Domain-Driven Design (DDD) & Clean Architecture** layering:

```mermaid
graph TD
    subgraph "Layer 1: Presentation"
        Pres["Controllers, Routes, Pages, Views, Handlers, API"]
    end

    subgraph "Layer 2: Application"
        App["Services, UseCases, Commands, Queries, Workflows"]
    end

    subgraph "Layer 3: Domain"
        Dom["Entities, Aggregates, Models, Value Objects"]
    end

    subgraph "Layer 4: Infrastructure"
        Infra["Repositories, Database, Storage, External Adapters"]
    end

    subgraph "Shared Cross-Cutting"
        Shared["Utils, Types, Config, Common, Helpers"]
    end

    Pres --> App
    App --> Dom
    App --> Infra
    Dom -.->|Dependency Inversion| Infra
    Pres --> Shared
    App --> Shared
    Dom --> Shared
    Infra --> Shared
```

### Architectural Regressions Detected:

1. **`LAYER_REGRESSION`**:
   - **Presentation Calling Infrastructure**: Bypassing the service layer (e.g. a Next.js `page.tsx` or `Controller` importing a database `Repository` directly).
   - **Domain Depending on Infrastructure**: Direct imports from domain entities to database adapters (violating Dependency Inversion).
   - **Application Depending on Presentation**: Inverted upstream imports.
2. **`BOUNDED_CONTEXT_LEAK` & `PUBLIC_API_BYPASS`**:
   - Modules importing internal/private files from another module (e.g. `import { helper } from '../billing/internal/foo'`) rather than the public module entry point (`../billing/index.ts`).
3. **CI/CD Quality Gate**:
   - Running `atlas analyze --architecture --fail-on-architecture` automatically fails pull requests if architectural regressions are detected.

---

## 🔒 Secret Redaction Pipeline

```mermaid
sequenceDiagram
    participant Disk as Source Files on Disk
    participant Indexer as @codeatlas-ai/indexer
    participant Scanner as SecretScanner (@codeatlas-ai/core)
    participant Parser as @codeatlas-ai/parser
    participant Storage as SQLite DB (.atlas/atlas.db)
    participant MCP as MCP Server (@codeatlas-ai/mcp)
    participant LLM as AI Assistant (Antigravity / Claude)

    Disk->>Indexer: Read raw file content
    Indexer->>Scanner: Pass buffer to redactSecrets()
    Scanner-->>Indexer: Sanitized content ([REDACTED_*])
    Indexer->>Parser: Parse sanitized AST
    Indexer->>Storage: Store sanitized content in FTS5
    Storage-->>Indexer: Index committed (zero raw secrets stored)

    Note over MCP,LLM: MCP Egress Verification
    LLM->>MCP: Call atlas_compress / atlas_get_context
    MCP->>Scanner: Run egress sanitization
    Scanner-->>MCP: Scrubbed output payload
    MCP-->>LLM: Safe context pack
```

---

## Package Responsibilities

### `@codeatlas-ai/core`
The central domain layer. Defines all canonical interfaces (`SymbolInfo`, `FileInfo`, `ContextPack`, `RuleConfig`), language mappings, and the **`SecretScanner`** engine with high-entropy entropy filters.

### `@codeatlas-ai/parser`
Tree-sitter AST extraction pipeline, **TypeScript Semantic Resolver** (inheritance and `@/*` aliases), and **Framework Adapters** (React Hooks, Next.js App Router, NestJS DI, Prisma Schema).

### `@codeatlas-ai/storage`
Encapsulates SQLite interactions via Node 22 native `node:sqlite`. Manages WAL mode, composite indexes, FTS5 full-text search, and database migrations (1–5).

### `@codeatlas-ai/analytics`
The **`ArchitectureAnalyzer`** performs automatic DDD layer classification, detects layer regressions and context leaks, computes project Clean Scores, and runs SAST security taint tracking.

### `@codeatlas-ai/rules`
The **`RuleGenerator`** inspects project evidence (`tsconfig.json`, `package.json`, test configurations) and produces evidence-backed guidelines for Antigravity (`AGENTS.md`), Claude (`CLAUDE.md`), and Cursor (`.cursorrules`).

### `@codeatlas-ai/mcp`
Model Context Protocol server implementing 16 AI tools for deep call graph tracing, symbol blast radius calculations, architectural sanity audits, and feature implementation blueprints.

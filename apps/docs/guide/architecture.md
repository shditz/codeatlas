# System Architecture

CodeAtlas is organized as a decoupled, modular TypeScript monorepo operating under strict domain-driven boundaries.

---

## Monorepo Architecture

```
CodeAtlas/
├── packages/
│   ├── core/           Domain models, interfaces, and shared types
│   ├── parser/         Multi-language Tree-sitter AST extraction pipeline
│   ├── storage/        SQLite persistent repository and schema management
│   ├── graph/          In-memory directed graph algorithms and topological sorters
│   ├── rules/          Template engine and AI prompt exporter
│   ├── compression/    Token optimization and symbol summarizer
│   ├── retrieval/      BM25 ranking and lexical indexer
│   └── mcp/            Model Context Protocol server implementation
└── apps/
    ├── cli/            Command-line application entry point (`atlas`)
    ├── vscode-extension/ Official Visual Studio Code extension
    ├── webview/        React force-directed graph web application
    └── docs/           VitePress documentation site
```

---

## End-to-End Execution Flow

```mermaid
sequenceDiagram
    participant User as Developer / CLI / VS Code
    participant CLI as @codeatlas/cli
    participant Parser as @codeatlas/parser
    participant Storage as @codeatlas/storage (SQLite)
    participant Rules as @codeatlas/rules
    participant Webview as @codeatlas/webview

    User->>CLI: atlas index
    CLI->>Parser: Parse files via Tree-sitter
    Parser-->>CLI: AST Nodes, Symbols & Imports
    CLI->>Storage: Upsert files, symbols, and dependencies
    Storage-->>CLI: Transaction Committed

    opt Generate Rules
        User->>CLI: atlas rules --all
        CLI->>Storage: Fetch project topology & symbols
        CLI->>Rules: Compile platform templates
        Rules-->>User: Write .cursorrules, CLAUDE.md, etc.
    end

    opt Visualize
        User->>Webview: Open Interactive Graph
        Webview->>Storage: Request nodes & containment links
        Storage-->>Webview: Stream JSON Payload
        Webview-->>User: Render 3D/2D Constellation Canvas
    end
```

---

## Package Responsibilities

### `@codeatlas/core`

The central domain layer containing zero external runtime dependencies. Defines all canonical interfaces (`Project`, `SourceFile`, `SymbolInfo`, `DependencyLink`, `RuleConfig`).

### `@codeatlas/parser`

Orchestrates language-specific grammars (`tree-sitter-typescript`, `tree-sitter-javascript`, `tree-sitter-python`, `tree-sitter-php`, `tree-sitter-go`, `tree-sitter-rust`). Extracts signatures, comments, and normalized imports.

### `@codeatlas/storage`

Encapsulates SQLite interactions using `better-sqlite3`. Manages database schema migrations, connection pooling, and repository query optimizations.

### `@codeatlas/graph`

Maintains an in-memory graph data structure using adjacency lists. Implements algorithms for cycle detection, reachability analysis, and critical path analysis.

### `@codeatlas/rules`

Generates target-specific configuration files for AI coding agents. Uses deterministic templating to combine project metadata, linter rules, and architectural guidelines.

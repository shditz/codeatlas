# CodeAtlas Architecture & System Design

This document describes the architectural design, core pipelines, data structures, dependency boundaries, and technical decisions of CodeAtlas.

---

## 1. Architectural Principles

CodeAtlas is built around six foundational engineering principles:

1. **Local-First Execution**: All indexing, AST parsing, graph computations, and context assembly execute locally on the developer's machine. Core functionality requires zero network connectivity.
2. **Deterministic Indexing**: The same codebase state and configuration produce identical graph topologies, symbol tables, and complexity scores.
3. **Explicit Trust Boundaries**: Repository source files, external MCP tool invocations, and editor messages are treated as untrusted input. File system interactions are strictly bounded to the workspace root.
4. **Separation of Concerns**: Ingestion, parsing, persistence, graph computation, retrieval, and presentation are decoupled into isolated packages with unidirectional dependency flow.
5. **Defense-in-Depth Privacy**: Credentials and secrets are scrubbed in-memory before entering the local database and re-checked before egress to AI clients.
6. **Graceful Degradation**: Individual file parsing failures, malformed syntax trees, or unsupported languages never abort the overall indexing pipeline.

---

## 2. System Overview

### 2.1 Logical Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Interfaces                             │
│       CLI (`atlas`)    │   VS Code Extension   │   MCP Stdio Server     │
└────────────────┬───────────────────────┬───────────────────────┬────────┘
                 │                       │                       │
                 ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Application Layer                             │
│   Context Packing   │  AI Rule Generator  │  Architecture Analyzer     │
└────────────────┬───────────────────────┬───────────────────────┬────────┘
                 │                       │                       │
                 ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Intelligence Layer                            │
│   Multi-Source Retrieval  │  Ranking & Fusion  │  AST Skeletonizer      │
└────────────────┬───────────────────────┬───────────────────────────────┘
                 │                       │
                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Graph & Core Layer                            │
│   Directed Dependency Graph (DAG) Engine  │  SecretScanner Redaction    │
└────────────────────────────────────────┬────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Storage & Parsing                             │
│   SQLite Database (WAL Mode) + FTS5    │  Tree-sitter AST & Resolvers   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Data Pipelines

### 3.1 Indexing Pipeline (Write Path)

The indexing pipeline transforms raw repository files into structured graph nodes, symbols, and full-text search indexes:

```
Source Files (Disk)
       │
       ▼
1. File Scanner (Filters `.gitignore`, `.atlasignore`, and binary files)
       │
       ▼
2. Secret Redaction (`SecretScanner` scrubs credentials in-memory)
       │
       ▼
3. AST Parsing (Tree-sitter parses syntax trees & computes cyclomatic complexity)
       │
       ▼
4. Semantic Resolution (Resolves path aliases `@/*`, type inheritance `extends`/`implements`)
       │
       ▼
5. Persistence (`@codeatlas-ai/storage` commits files, symbols, deps, and FTS5 tokens to SQLite)
       │
       ▼
6. Graph Materialization (Constructs in-memory directed dependency graph)
```

### 3.2 Context Retrieval Pipeline (Read Path)

When an AI assistant or developer requests context for a specific task:

```
Task Query & Intent (`bug` | `feature` | `refactor`)
       │
       ▼
1. Hybrid Search (FTS5 BM25 keyword match + Graph proximity expansion)
       │
       ▼
2. Relevance Ranking (PageRank centrality + Git churn + Import depth weighting)
       │
       ▼
3. Token Budget Allocation (Dynamically allocates tokens across prioritized files)
       │
       ▼
4. AST Skeletonization (Compresses non-essential files into type signatures)
       │
       ▼
5. Egress Sanitization (Re-verifies payload for sensitive tokens)
       │
       ▼
Context Pack (Delivered via MCP JSON-RPC or CLI output)
```

---

## 4. Package Responsibilities & Dependency Rules

CodeAtlas is organized as a monorepo under `packages/*` and `apps/*`. Dependencies must follow a strict downward hierarchy:

```
apps/ (cli, vscode-extension, mcp-server, webview, docs)
  └── packages/context, packages/analytics, packages/mcp
        └── packages/retrieval, packages/ranking, packages/compression, packages/rules
              └── packages/graph, packages/indexer
                    └── packages/parser, packages/storage, packages/git
                          └── packages/core, packages/shared
```

### Invariant Dependency Rules

- **`packages/core`** must have zero internal package dependencies. It defines shared domain models (`SymbolInfo`, `FileInfo`, `ContextPack`), configuration interfaces, and `SecretScanner`.
- **`packages/parser`** must never depend on `storage`, `retrieval`, or `mcp`. It is a pure syntax extraction layer.
- **`packages/storage`** must not import UI or LLM client libraries. It handles SQLite connections, transactions, and migrations.
- **`packages/graph`** implements pure in-memory graph algorithms (Tarjan SCC, PageRank, Louvain clustering, Blast Radius BFS) independent of database adapters.
- **`apps/*`** must not contain direct database queries; they interact with the engine via service classes.

---

## 5. Storage Architecture & Data Model

CodeAtlas stores all repository intelligence in a single embedded SQLite database file located at `.atlas/atlas.db` using **Write-Ahead Logging (WAL)** mode for concurrent read/write access.

### 5.1 Entity Relationship Model

```
┌─────────────────────────────────────────────────────────────┐
│                          projects                           │
│  id (PK), name, root_path, created_at, updated_at           │
└──────────────┬───────────────────────────────┬──────────────┘
               │ 1                             │ 1
               │                               │
               ▼ *                             ▼ *
┌─────────────────────────────┐   ┌─────────────────────────────┐
│            files            │   │            rules            │
│  id (PK), project_id (FK),  │   │  id (PK), project_id (FK),  │
│  path, hash, lines, lang    │   │  path, scope, content       │
└──────┬──────────────┬───────┘   └─────────────────────────────┘
       │ 1            │ 1
       │              │
       ▼ *            ▼ *
┌──────────────┐ ┌──────────────┐ ┌─────────────────────────────┐
│   symbols    │ │ dependencies │ │         git_metrics         │
│ id (PK),     │ │ id (PK),     │ │ file_id (PK, FK),           │
│ file_id (FK),│ │ project_id,  │ │ commit_count, last_modified,│
│ name, kind,  │ │ source_path, │ │ churn_score                 │
│ line_start,  │ │ target_path, │ └─────────────────────────────┘
│ complexity   │ │ kind, conf   │
└──────────────┘ └──────────────┘
```

### 5.2 Full-Text Search (FTS5)

Text search is powered by SQLite's native `FTS5` extension:

- `files_fts`: Full-text search across relative file paths and sanitized source text.
- `symbols_fts`: Tokenized symbol names and identifiers for sub-millisecond symbol lookups.
- BM25 ranking algorithm scores keyword relevance, boosted by structural centrality metrics during retrieval.

---

## 6. Security & Trust Boundaries

```
                 Untrusted Filesystem Input
                             │
                             ▼
                    [ SecretScanner ]
                             │
               ┌─────────────┴─────────────┐
               ▼                           ▼
       [ Parser Engine ]           [ FTS5 Storage ]
               │                           │
               └─────────────┬─────────────┘
                             ▼
                    Local SQLite Database
                             │
                             ▼
                    [ Egress Sanitizer ]
                             │
                             ▼
                    AI Agent via MCP Stdio
```

- **Ingestion Redaction**: Raw buffers read from disk pass through `SecretScanner` to mask private keys, cloud tokens, database URIs, and JWTs before AST parsing or SQLite persistence.
- **Egress Verification**: Context packs generated for LLM consumption pass through a secondary redaction check to ensure no dynamically evaluated secrets leak over the MCP transport.
- **Isolated Webview Boundary**: The VS Code Extension webview runs in an isolated context with restricted `localResourceRoots` and strict Content Security Policy (CSP).

---

## 7. Key Design Decisions

### Why SQLite?

- **Zero-Configuration & Portability**: Runs embedded inside Node.js 22 (`node:sqlite`) without requiring an external database daemon (PostgreSQL, Neo4j, or Redis).
- **Embedded Full-Text Search**: Built-in SQLite FTS5 provides fast BM25 ranking without external search infrastructure.
- **Single-File Isolation**: The entire index lives in `.atlas/atlas.db`, making cache invalidation and cleanup as simple as deleting the `.atlas/` folder.

### Why Tree-sitter?

- **Polyglot Parsing**: High-quality, maintained concrete syntax tree grammars across 20+ programming languages.
- **Resilience**: Tree-sitter is an error-tolerant parser that produces usable syntax trees even when files contain syntax errors or are actively being typed by a developer.

### Why Model Context Protocol (MCP)?

- **Universal AI Standard**: Decouples CodeAtlas from vendor-specific AI models, allowing Google Antigravity, Claude Code, Cursor, Windsurf, and custom CLI agents to query repository intelligence via standard JSON-RPC over `stdio`.

### Why Directed Dependency Graph?

- **Deterministic Structural Analysis**: Codebase dependencies are not strictly acyclic—circular imports occur frequently in real repositories. A general directed graph enables cycle detection (Tarjan SCC), centrality analysis (PageRank), and blast radius traversal (BFS/DFS).

---

## 8. Failure Modes & Graceful Degradation

| Failure Scenario                  | System Response & Mitigation                                                                                                                         |
| :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Individual File Parser Error**  | The error is caught and logged. The file is indexed as text for FTS search without AST symbols. Indexing continues for the remainder of the project. |
| **Corrupted SQLite Database**     | `atlas doctor` detects integrity violations. Running `atlas clean && atlas index` recreates the SQLite schema cleanly from source files.             |
| **Circular Dependency in Code**   | Graph traversals track visited nodes with depth limits, preventing infinite recursion while logging the cycle for architectural health reporting.    |
| **Unsupported Language Grammar**  | The file is indexed via FTS5 for keyword matching without AST symbol decomposition.                                                                  |
| **Large File Threshold Exceeded** | Files exceeding the configured size limit (`max_file_size` in `.atlas/config.toml`) are skipped to protect memory budgets.                           |

---

## 9. Extension Points

CodeAtlas is architected for modular extension:

- **Adding a Language Parser**: Implement an AST extractor in `packages/parser/src/` conforming to Tree-sitter grammar node mappings.
- **Adding a Framework Adapter**: Register a decorator/route handler extractor in `packages/parser/src/frameworks/` to recognize framework idioms (e.g. Next.js, Spring, FastAPI).
- **Adding an MCP Tool**: Register tool schemas and execution handlers in `packages/mcp/src/mcp-server.ts`.
- **Custom Architecture Rules**: Define forbidden layer relationships in `.atlas/config.toml` under `[architecture.rules.disallow]`.

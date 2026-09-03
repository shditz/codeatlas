# CodeAtlas — Master Project Context & Knowledge Base

> **Internal AI Context Document**: This document serves as the single source of truth for AI coding agents, maintainers, and contributors working on **CodeAtlas**. It details the complete architecture, package hierarchy, database schemas, algorithms, CLI commands, MCP tools, and step-by-step instructions on how to navigate and modify this codebase.

---

## Table of Contents

1. [Project Mission & Overview](#1-project-mission--overview)
2. [Monorepo Architecture & Package Map](#2-monorepo-architecture--package-map)
3. [Core Subsystems & Execution Lifecycles](#3-core-subsystems--execution-lifecycles)
   - [3.1 AST Parsing Engine (`@codeatlas-ai/parser`)](#31-ast-parsing-engine-codeatlas-aiparser)
   - [3.2 Storage & SQLite FTS5 Database (`@codeatlas-ai/storage`)](#32-storage--sqlite-fts5-database-codeatlas-aistorage)
   - [3.3 Indexing & Scanner Subsystem (`@codeatlas-ai/indexer`)](#33-indexing--scanner-subsystem-codeatlas-aiindexer)
   - [3.4 Dependency Graph & Cypher Query Engine (`@codeatlas-ai/graph`)](#34-dependency-graph--cypher-query-engine-codeatlas-aigraph)
   - [3.5 Context Retrieval & Hybrid Ranking Engine (`@codeatlas-ai/retrieval`, `@codeatlas-ai/ranking`)](#35-context-retrieval--hybrid-ranking-engine-codeatlas-airetrieval-codeatlas-airanking)
   - [3.6 Context Packing & Skeleton Compression (`@codeatlas-ai/context`, `@codeatlas-ai/compression`)](#36-context-packing--skeleton-compression-codeatlas-aicontext-codeatlas-aicompression)
   - [3.7 Multi-Agent Rules Governance (`@codeatlas-ai/rules`, `@codeatlas-ai/exporters`)](#37-multi-agent-rules-governance-codeatlas-airules-codeatlas-aiexporters)
   - [3.8 Codebase Analytics & Health Diagnostics (`@codeatlas-ai/analytics`)](#38-codebase-analytics--health-diagnostics-codeatlas-aianalytics)
   - [3.9 Natural Language to Cypher & LLM Integration (`@codeatlas-ai/nl2cypher`, `@codeatlas-ai/llm`)](#39-natural-language-to-cypher--llm-integration-codeatlas-ainl2cypher-codeatlas-aillm)
   - [3.10 Model Context Protocol (MCP) Server (`@codeatlas-ai/mcp`, `apps/mcp-server`)](#310-model-context-protocol-mcp-server-codeatlas-aimcp-appsmcp-server)
4. [Complete CLI Commands Reference (16 Commands)](#4-complete-cli-commands-reference-16-commands)
5. [Complete MCP Tools Reference (12 Tools)](#5-complete-mcp-tools-reference-12-tools)
6. [Database Schema & Storage Architecture](#6-database-schema--storage-architecture)
7. [AI Agent Reading Guide & File Pointers](#7-ai-agent-reading-guide--file-pointers)
8. [Build, Test, and CI/CD Conventions](#8-build-test-and-cicd-conventions)

---

## 1. Project Mission & Overview

**CodeAtlas** is an open-source **Context Intelligence and Codebase Mapping Platform** designed specifically for AI coding assistants (Claude Code, Cursor, GitHub Copilot, Google Antigravity, Windsurf, Devin, Cline, etc.).

### Why CodeAtlas Exists

Modern AI coding models suffer from:

1. **Context Window Saturation**: Stuffing entire codebases into prompts is expensive, slow, and degrades LLM reasoning.
2. **Context Blindness / Hallucinations**: LLMs do not know project-wide symbol hierarchies, call chains, or cross-module dependencies without explicit indexing.
3. **Rule Fragmentation**: Coding instructions are scattered across different formats (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `.gemini/config`).

### The CodeAtlas Solution

- **Native AST & Graph Mapping**: Parses 17+ programming languages using Tree-Sitter into a structured SQLite property graph.
- **Hybrid Retrieval & Ranking**: Blends SQLite FTS5 BM25 lexical search, PageRank graph centrality, file proximity, symbol definitions, and recency scoring.
- **Token-Budgeted Context Packing**: Extracts interface signatures ("code skeletons") to pack 5–10x more relevant architectural context within token budgets.
- **Unified Multi-Agent MCP Server**: Exposes 12 MCP tools, 3 resources, and 3 prompts over JSON-RPC stdio.
- **Cross-Agent Rule Synchronization**: Bridges instructions seamlessly across all AI IDEs and agents.

---

## 2. Monorepo Architecture & Package Map

CodeAtlas is organized as a high-performance **pnpm monorepo** with TypeScript, strict type safety, Node 22 native SQLite, and `tsup` bundling.

```
CodeAtlas/
├── apps/                         # Standalone applications, integrations & tools
│   ├── cli/                      # 'atlas' CLI application (16 commands)
│   ├── docs/                     # VitePress documentation portal
│   ├── jetbrains-plugin/         # JetBrains IDE integration (Kotlin)
│   ├── mcp-server/               # Standalone MCP stdio binary
│   ├── neovim-plugin/            # Neovim plugin (Lua)
│   ├── vscode-extension/         # VS Code Extension (Sidebar & Graph UI)
│   └── webview/                  # 2D/3D Force-Directed Graph Webview (React + Three.js)
│
├── packages/                     # Modular core domain libraries
│   ├── analytics/                # Cycles, dead code, coupling & hotspots
│   ├── compression/              # Tree-Sitter AST skeleton & interface compressor
│   ├── context/                  # Token-budgeted context assembler & pack generator
│   ├── core/                     # Core domain types, Zod schemas, language definitions
│   ├── exporters/                # Cross-agent rule exporters (Claude, Cursor, Antigravity)
│   ├── git/                      # Git diff analysis, PR impact & commit metadata
│   ├── github-action/            # Automated PR context & review GitHub Action
│   ├── graph/                    # In-memory dependency graph & Cypher query engine
│   ├── indexer/                  # File scanner, batch indexer & live file watcher
│   ├── llm/                      # LLM provider abstractions (OpenAI, Anthropic, Gemini)
│   ├── mcp/                      # Model Context Protocol server implementation
│   ├── nl2cypher/                # Heuristic & LLM natural language to Cypher translator
│   ├── parser/                   # Multi-language Tree-Sitter AST parser (17+ grammars)
│   ├── ranking/                  # Multi-factor hybrid ranking algorithm
│   ├── retrieval/                # Multi-stage context retrieval engine
│   ├── rules/                    # Rule discovery, validation & conflict detector
│   ├── shared/                   # Result types, logger, error handling & path utils
│   ├── storage/                  # Node 22 SQLite database, migrations & FTS5 search
│   └── token-counter/            # Fast, accurate token estimator
│
├── .atlas/                       # Project local cache (database, config & snapshots)
│   ├── atlas.db                  # SQLite database with FTS5 virtual tables
│   └── config.toml               # User configuration overrides
└── .atlasignore                  # Secret and noise exclusion patterns
```

### Detailed Package Responsibilities

| Package                           | Primary Role                                                                                                                                                         | Key Entry File                                                                                                         |
| :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **`@codeatlas-ai/core`**          | Fundamental types (`FileInfo`, `SymbolInfo`, `ProjectMeta`, `ContextPack`), Zod config schemas, language registry.                                                   | [`packages/core/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/core/src/index.ts)                   |
| **`@codeatlas-ai/shared`**        | `Result<T, E>`, logging with color formatting, path normalization, error hierarchies.                                                                                | [`packages/shared/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/shared/src/index.ts)               |
| **`@codeatlas-ai/storage`**       | Native `node:sqlite` wrapper, 10+ relational tables, FTS5 full-text search, repositories.                                                                            | [`packages/storage/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/storage/src/index.ts)             |
| **`@codeatlas-ai/parser`**        | Multi-grammar Tree-Sitter AST parser with symbol/import extraction for 17+ languages.                                                                                | [`packages/parser/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/parser/src/index.ts)               |
| **`@codeatlas-ai/graph`**         | Directed dependency graph, PageRank centrality, cycle detection, Cypher query executor.                                                                              | [`packages/graph/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/graph/src/index.ts)                 |
| **`@codeatlas-ai/indexer`**       | Directory crawler, `.gitignore`/`.atlasignore` filtering, incremental hashing, live watcher.                                                                         | [`packages/indexer/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/indexer/src/index.ts)             |
| **`@codeatlas-ai/ranking`**       | 7-factor weighted ranking engine (lexical, symbols, path, PageRank, rules, recency, module).                                                                         | [`packages/ranking/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/ranking/src/index.ts)             |
| **`@codeatlas-ai/retrieval`**     | Multi-stage candidate retrieval combining FTS5 lexical matching and graph radius expansion.                                                                          | [`packages/retrieval/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/retrieval/src/index.ts)         |
| **`@codeatlas-ai/compression`**   | AST skeleton stripper that replaces function bodies with comments to save tokens.                                                                                    | [`packages/compression/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/compression/src/index.ts)     |
| **`@codeatlas-ai/context`**       | Token-budgeted context pack builder supporting 4 modes (`full`, `signature`, `summary`, `digest`).                                                                   | [`packages/context/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/context/src/index.ts)             |
| **`@codeatlas-ai/rules`**         | Multi-agent rules discoverer (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`), conflict detector.                                                                          | [`packages/rules/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/rules/src/index.ts)                 |
| **`@codeatlas-ai/exporters`**     | Rules exporter targeting Claude, Cursor, Antigravity, Copilot, and Windsurf formats.                                                                                 | [`packages/exporters/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/exporters/src/index.ts)         |
| **`@codeatlas-ai/analytics`**     | Architectural analysis: circular dependencies, unreferenced/dead code, coupling instability.                                                                         | [`packages/analytics/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/analytics/src/index.ts)         |
| **`@codeatlas-ai/git`**           | Git branch diffing, PR impact calculation, affected dependent file discovery.                                                                                        | [`packages/git/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/git/src/index.ts)                     |
| **`@codeatlas-ai/nl2cypher`**     | Heuristic and LLM-powered natural language to Cypher graph query translator.                                                                                         | [`packages/nl2cypher/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/nl2cypher/src/index.ts)         |
| **`@codeatlas-ai/llm`**           | Multi-provider unified LLM client interface (OpenAI, Anthropic, Gemini, Ollama).                                                                                     | [`packages/llm/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/llm/src/index.ts)                     |
| **`@codeatlas-ai/token-counter`** | Fast byte/character token estimation model.                                                                                                                          | [`packages/token-counter/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/token-counter/src/index.ts) |
| **`@codeatlas-ai/mcp`**           | Model Context Protocol JSON-RPC 2.0 implementation with 16 tools, 3 resources, 3 prompts, and **`McpConfigurator`** (1-Click automated setup for 14+ AI assistants). | [`packages/mcp/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/mcp/src/index.ts)                     |
| **`@codeatlas-ai/github-action`** | CI/CD GitHub Action runner for automated PR impact and architecture reports.                                                                                         | [`packages/github-action/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/github-action/src/index.ts) |

---

## 3. Core Subsystems & Execution Lifecycles

### 3.1 AST Parsing Engine (`@codeatlas-ai/parser`)

- **Supported Grammars**: TypeScript, JavaScript, TSX, JSX, Python, Rust, Go, Java, C, C++, Ruby, PHP, Kotlin, Lua, C#, Swift, HTML, CSS, JSON, YAML, Markdown.
- **Parser Architecture**:
  - Uses native `tree-sitter` bindings.
  - Recursively traverses syntax trees to extract symbols (`class`, `function`, `interface`, `type_alias`, `enum`, `method`, `variable`) with line/column coordinates and signatures.
  - Extracts module imports (`import ... from '...'`, `require(...)`, Python `import/from`, Go `import`, Rust `use`, etc.) and resolves them to relative file paths.
  - **Graceful Fallback**: If a language grammar is missing or fails, a regex-based fallback extractor extracts high-level definitions without throwing errors.

### 3.2 Storage & SQLite FTS5 Database (`@codeatlas-ai/storage`)

- **Native Driver**: Uses Node.js 22 built-in `node:sqlite` (`DatabaseSync`), requiring zero external native binaries or compilation.
- **Relational Schema**: 10 tables managing projects, files, symbols, imports, dependencies, rules, index state, snapshots, and migration history.
- **Full-Text Search**: Two SQLite FTS5 virtual tables (`files_fts` and `symbols_fts`) with Porter stemming and `unicode61` tokenization for instant BM25 matching.

### 3.3 Indexing & Scanner Subsystem (`@codeatlas-ai/indexer`)

- **Scanner**: Crawls the directory tree, respecting `.gitignore` and `.atlasignore`, skipping binary files, files exceeding `max_file_size` (default: 1MB), and node_modules/vendor directories.
- **Incremental Indexing**: Uses SHA-256 content hashing. Unchanged files are skipped during re-indexing.
- **Watcher**: Uses `chokidar` to detect real-time file changes, debouncing updates and incrementally re-indexing ASTs in the background.

### 3.4 Dependency Graph & Cypher Query Engine (`@codeatlas-ai/graph`)

- **Graph Topology**: Represents files and symbols as nodes, with directed edges representing `import`, `call`, `extends`, or `implements`.
- **PageRank & Centrality**: Computes PageRank scores to identify foundational core files (high in-degree) vs. peripheral leaves.
- **Cypher Query Engine**: Custom AST-based Cypher parser supporting:
  ```cypher
  MATCH (f:File)-[:IMPORTS]->(t:File) WHERE f.language = 'typescript' RETURN f.name, t.name
  ```

### 3.5 Context Retrieval & Hybrid Ranking Engine (`@codeatlas-ai/retrieval`, `@codeatlas-ai/ranking`)

When given a user task (e.g. `"Implement OAuth2 authentication flow"`), CodeAtlas runs a multi-stage pipeline:

1. **Lexical Retrieval**: Queries FTS5 for files containing matching tokens.
2. **Graph Expansion**: Traverses dependency edges 1–2 hops away to find upstream/downstream related files.
3. **Hybrid Scoring Formula**:
   $$\text{Score} = w_1 \cdot \text{Lexical} + w_2 \cdot \text{Symbol} + w_3 \cdot \text{Path} + w_4 \cdot \text{PageRank} + w_5 \cdot \text{Rules} + w_6 \cdot \text{Recency} + w_7 \cdot \text{Module}$$
   _(Default weights: Lexical: 0.25, Symbol: 0.20, Path: 0.15, Dependency: 0.15, Rule: 0.10, Recency: 0.10, Module: 0.05)_.

### 3.6 Context Packing & Skeleton Compression (`@codeatlas-ai/context`, `@codeatlas-ai/compression`)

- **Budget Allocation**: Fits the most important files within the requested `maxTokens` (default: 12,000).
- **Compression Modes**:
  - `full`: Complete raw source code.
  - `signature`: Keeps imports, types, interfaces, and function signatures with stripped implementation bodies (`/* implementation omitted */`).
  - `summary`: Structural symbol outline and docstrings.
  - `digest`: Single-line module summaries and exported symbol lists.

### 3.7 Multi-Agent Rules Governance (`@codeatlas-ai/rules`, `@codeatlas-ai/exporters`)

- **Discovered Rule Formats**:
  - `AGENTS.md` (General agent standard)
  - `CLAUDE.md` (Anthropic Claude Code)
  - `.cursorrules` / `.cursor/rules/*` (Cursor)
  - `.windsurfrules` (Windsurf)
  - `.gemini/config/rules/*` (Google Antigravity / Gemini)
  - `.github/copilot-instructions.md` (GitHub Copilot)
- **Conflict Detection**: Scans for contradictory rules across different rule files.
- **Exporting**: Generates unified guidelines or converts existing rules to target specific AI agents.

### 3.8 Codebase Analytics & Health Diagnostics (`@codeatlas-ai/analytics`)

- **Cycle Detector**: Identifies circular dependency loops (`A -> B -> C -> A`) using Tarjan's strongly connected components algorithm.
- **Dead Code Detector**: Finds unreferenced symbols and orphan files with zero incoming import edges.
- **Coupling & Hotspots**: Computes Afferent ($C_a$) and Efferent ($C_e$) coupling, module instability ($I = C_e / (C_a + C_e)$), and cyclomatic hotspots.

### 3.9 Natural Language to Cypher & LLM Integration (`@codeatlas-ai/nl2cypher`, `@codeatlas-ai/llm`)

- Translates natural language queries (e.g. `"Which files import the database?"`) into valid Cypher queries using heuristic pattern matchers or LLM providers (OpenAI, Anthropic, Gemini).

### 3.10 Model Context Protocol (MCP) Server & Universal Configurator (`@codeatlas-ai/mcp`, `apps/mcp-server`)

- Provides standard JSON-RPC 2.0 stdio transport compatible with Claude Desktop, Cursor, Google Antigravity, Windsurf, Trae, Zed, Continue, Cline, Roo, Codex, and VS Code.
- **Pure Stdio Stream Isolation**: Automatic redirection of all `console.log` / `console.info` calls to `stderr`, ensuring `stdout` remains 100% pure JSON-RPC without log pollution or parsing crashes.
- **Universal Multi-Agent Configurator (`McpConfigurator`)**: Single-command automated installation into all local or global AI assistants (`atlas mcp setup --all`).
- **Safe JSONC Comment Stripping**: Built-in parser (`safeParseJson` / `stripJsonComments`) that safely parses configurations containing comments (`// ...`, `/* ... */`) and trailing commas (e.g. Zed and VS Code `settings.json`) without wiping existing user settings.
- **Cross-Platform Executable Resolution (`command-resolver`)**: Auto-detects direct Node entrypoints across any version manager (NVM, FNM, Volta, ASDF, Homebrew), with fallback to `cmd.exe /c atlas` on Windows to eliminate `ENOENT` spawn errors.
- **Process Lifecycle Management**: Automatic cleanup and graceful closing of SQLite database handles on `stdin` close (`rl.on('close')`), `SIGTERM`, and `SIGINT`, preventing background zombie processes.
- Exposes **22 Tools**, **3 Resources**, and **3 Prompts**.

---

## 4. Complete CLI Commands Reference (21 Commands & Subcommands)

The CodeAtlas CLI (`atlas`) is located at [`apps/cli`](file:///c:/Users/DELL/Downloads/CodeAtlas/apps/cli):

| Command                      | Description                                                                          | Key Options / Flags                                                                          |
| :--------------------------- | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **`atlas init`**             | Initializes `.atlas/` directory, default `config.toml`, and `.atlasignore`.          | `--force`                                                                                    |
| **`atlas scan`**             | Scans repository to detect languages, frameworks, package managers, and monorepos.   | `--json`                                                                                     |
| **`atlas index`**            | Parses ASTs, extracts symbols/imports, and builds SQLite index and dependency graph. | `--staged-only`, `--force`, `--verbose`                                                      |
| **`atlas map`**              | Displays visual tree map of codebase structure with exported symbols.                | `--depth <n>`, `--json`, `--module <name>`                                                   |
| **`atlas search <query>`**   | Performs full-text & symbol search with BM25 ranking and semantic vector matching.   | `--limit <n>`, `--type <file\|symbol>`, `--semantic`, `--json`                               |
| **`atlas context <task>`**   | Packs token-budgeted, ranked context for a coding prompt.                            | `--max-tokens <n>`, `--mode <full\|signature\|summary\|digest>`, `--intent <type>`, `--json` |
| **`atlas rules`**            | Discovers, parses, validates, and audits AI coding rules.                            | `--validate`, `--detect-conflicts`, `--export <agent>`, `--json`                             |
| **`atlas export`**           | Exports architecture maps, context, or rules to Markdown or JSON.                    | `--format <markdown\|json>`, `--output <file>`                                               |
| **`atlas doctor`**           | Diagnoses database health, missing indexes, and repository readiness.                | `--heal`, `--json`                                                                           |
| **`atlas clean`**            | Cleans `.atlas/` database, cached snapshots, and temporary files.                    | `--all`                                                                                      |
| **`atlas mcp`**              | Starts the Model Context Protocol (MCP) stdio server.                                | `--path <dir>`                                                                               |
| **`atlas mcp setup`**        | Automatically configures CodeAtlas MCP into AI coding assistants.                    | `-t <target>`, `--all`, `--scope <global\|workspace>`, `--dry-run`, `--force`                |
| **`atlas mcp doctor`**       | Runs end-to-end MCP protocol handshake, stdio purity check, and AI config audit.     | `--path <dir>`                                                                               |
| **`atlas mcp list-targets`** | Lists all supported AI coding assistant configuration targets and detected status.   | _(none)_                                                                                     |
| **`atlas watch`**            | Runs live watcher for real-time incremental re-indexing.                             | `--debounce <ms>`                                                                            |
| **`atlas diff`**             | Analyzes git branch diff, semantic blast radius, and downstream dependent modules.   | `--base <branch>`, `--staged`, `--budget <n>`, `--output <file>`, `--json`                   |
| **`atlas pr`**               | Generates comprehensive AI review context for a Pull Request.                        | `--base <branch>`, `--output <file>`                                                         |
| **`atlas query <cypher>`**   | Executes Cypher or natural language queries over the dependency graph.               | `--nl`, `--json`                                                                             |
| **`atlas analyze`**          | Audits codebase for circular dependencies, dead code, and coupling hotspots.         | `--cycles`, `--dead-code`, `--hotspots`, `--json`                                            |
| **`atlas install-hooks`**    | Installs Git pre-commit hooks for automatic incremental indexing on commit.          | `--force`                                                                                    |
| **`atlas audit`**            | Runs Static Application Security Testing (SAST) and Data-Flow Taint Analysis.        | `--file <path>`, `--json`, `--fail-on-vulnerabilities`                                       |
| **`atlas link <path>`**      | Federates and attaches an external repository database via `ATTACH DATABASE`.        | `--alias <name>`, `--list`, `--json`                                                         |

---

## 5. Complete MCP Tools Reference (22 Tools)

The CodeAtlas MCP Server exposes 22 comprehensive tools for AI agents:

```json
1.  atlas_scan                      -> Scan repository architecture, languages, frameworks, and workspaces
2.  atlas_index                     -> Trigger full or incremental AST indexing with secret redaction
3.  atlas_search                    -> FTS5 BM25, Semantic vector embedding, and RRF Hybrid search
4.  atlas_get_context               -> Retrieve ranked, intent-aware (bug/feature/refactor) token-budgeted context pack
5.  atlas_graph_query               -> Execute Cypher or Natural Language graph queries over AST dependency graph
6.  atlas_pr_diff                   -> Analyze Git PR diff with architectural impact and affected modules
7.  atlas_compress                  -> Extract AST signature skeleton and interface contracts to save tokens
8.  atlas_get_map                   -> Retrieve hierarchical codebase structural map with exported symbols
9.  atlas_get_rules                 -> Discover and audit active AI agent rules (AGENTS.md, Cursor, Claude, etc.)
10. atlas_doctor                   -> Run health diagnostics on repository indexing and context readiness
11. atlas_analyze                  -> Analyze codebase graph for dead code, circular dependencies, and hotspots
12. atlas_sql_query                -> Execute safe read-only SQL queries directly against SQLite database (.atlas/atlas.db)
13. atlas_apply_refactor           -> Safely apply code changes with AST syntax error validation before disk write
14. atlas_fix_circular_dependency  -> Analyze circular dependency loops and get architectural decoupling recommendations
15. atlas_security_audit           -> Automated SAST and Data-Flow Taint Analysis (SQLi, Command Injection, XSS, etc.)
16. atlas_federate_repo            -> Federate external workspace database using SQLite native ATTACH DATABASE
17. atlas_plan_feature             -> Autonomous feature planning agent generating actionable roadmap and candidates
18. atlas_detect_dead_code         -> Detect unreferenced files and orphan exported symbols across repository graph
19. atlas_complexity_report        -> Analyze and rank symbols by Cyclomatic Complexity for refactoring candidates
20. atlas_trace_execution_path     -> Trace exact execution/dependency path between two files with confidence scores
21. atlas_find_entry_points        -> Discover all top-level entry points and ingress modules invoking a target file
22. atlas_calculate_change_surface -> Calculate complete blast radius, downstream impact, and risk score for changes
```

### MCP Resources

- `atlas://architecture/map` — Codebase file list and structural summary.
- `atlas://architecture/rules` — Discovered multi-agent coding guidelines.
- `atlas://architecture/graph` — Dependency graph edges and coupling metrics.

### MCP Prompts

- `explain_codebase` — High-level architecture walkthrough prompt.
- `plan_feature` — Feature implementation plan generator with retrieved context.
- `review_pr` — Architectural PR code review prompt.

---

## 6. Database Schema & Storage Architecture

Database file: `.atlas/atlas.db` (SQLite 3 via Node 22 `node:sqlite`).

### Entity Relationship & Schema Summary

```sql
-- Projects & Metadata
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  root TEXT NOT NULL UNIQUE,
  package_manager TEXT NOT NULL DEFAULT 'unknown',
  is_monorepo INTEGER NOT NULL DEFAULT 0,
  languages TEXT NOT NULL DEFAULT '[]',
  frameworks TEXT NOT NULL DEFAULT '[]',
  workspaces TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexed Files
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  extension TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'unknown',
  size INTEGER NOT NULL DEFAULT 0,
  hash TEXT NOT NULL DEFAULT '',
  module TEXT NOT NULL DEFAULT '.',
  is_test INTEGER NOT NULL DEFAULT 0,
  is_generated INTEGER NOT NULL DEFAULT 0,
  symbol_count INTEGER NOT NULL DEFAULT 0,
  import_count INTEGER NOT NULL DEFAULT 0,
  export_count INTEGER NOT NULL DEFAULT 0,
  content TEXT,
  last_modified INTEGER,
  indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, relative_path)
);

-- Extracted AST Symbols
CREATE TABLE symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,          -- 'class', 'function', 'interface', 'variable', etc.
  line INTEGER NOT NULL,
  end_line INTEGER,
  column_num INTEGER NOT NULL DEFAULT 0,
  exported INTEGER NOT NULL DEFAULT 0,
  signature TEXT,
  parent_symbol TEXT,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Extracted Imports & References
CREATE TABLE imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  import_path TEXT NOT NULL,
  resolved_path TEXT,
  symbols TEXT NOT NULL DEFAULT '[]',
  is_default INTEGER NOT NULL DEFAULT 0,
  is_namespace INTEGER NOT NULL DEFAULT 0,
  is_type INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- File Dependencies (Graph Edges)
CREATE TABLE dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  source_path TEXT NOT NULL,
  target_path TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'import',
  symbols TEXT NOT NULL DEFAULT '[]',
  weight REAL NOT NULL DEFAULT 1.0,
  confidence REAL DEFAULT 1.0,
  resolution_reason TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Temporal Git Churn Metrics
CREATE TABLE git_metrics (
  file_id INTEGER PRIMARY KEY,
  commit_count INTEGER NOT NULL DEFAULT 0,
  last_modified INTEGER NOT NULL DEFAULT 0,
  churn_score REAL NOT NULL DEFAULT 0.0,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- AI Rules
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  project_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global',
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  path_pattern TEXT,
  agent_target TEXT,
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Semantic Vector Embeddings
CREATE TABLE embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  symbol_name TEXT,
  embedding TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, file_path, symbol_name)
);

-- Full-Text Search Virtual Tables (FTS5)
CREATE VIRTUAL TABLE files_fts USING fts5(
  relative_path,
  content,
  content='files',
  content_rowid='id',
  tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE symbols_fts USING fts5(
  name,
  signature,
  tokenize='porter unicode61'
);
```

---

## 7. AI Agent Reading Guide & File Pointers

When you (the AI coding agent) need to work on or debug specific features of CodeAtlas, **read the following files first**:

### 🎯 If you are working on...

1. **CLI Commands & Flags**:
   - Primary Entry: [`apps/cli/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/apps/cli/src/index.ts)
   - Command Implementations: [`apps/cli/src/commands/`](file:///c:/Users/DELL/Downloads/CodeAtlas/apps/cli/src/commands/)
     - `init.ts`, `scan.ts`, `index-cmd.ts`, `map.ts`, `search.ts`, `context.ts`, `rules.ts`, `export.ts`, `doctor.ts`, `clean.ts`, `mcp.ts`, `watch.ts`, `diff.ts`, `pr.ts`, `query.ts`, `analyze.ts`

2. **Model Context Protocol (MCP) Tools & Server**:
   - Tool Definitions & Handlers: [`packages/mcp/src/mcp-server.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/mcp/src/mcp-server.ts)
   - Standalone CLI Runner: [`apps/mcp-server/src/index.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/apps/mcp-server/src/index.ts)

3. **Tree-Sitter AST Parsing & Language Extraction**:
   - Multi-Grammar Parser: [`packages/parser/src/tree-sitter-parser.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/parser/src/tree-sitter-parser.ts)
   - Language Registry: [`packages/core/src/languages.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/core/src/languages.ts)

4. **Database, SQLite Driver & Migrations**:
   - Connection & Schema: [`packages/storage/src/database.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/storage/src/database.ts)
   - Migrations: [`packages/storage/src/migrations.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/storage/src/migrations.ts)
   - Repositories & FTS5: [`packages/storage/src/repositories.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/storage/src/repositories.ts), [`packages/storage/src/search.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/storage/src/search.ts)

5. **Context Retrieval, Ranking & Packing**:
   - Candidate Retrieval: [`packages/retrieval/src/retrieval-engine.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/retrieval/src/retrieval-engine.ts)
   - Hybrid Ranker: [`packages/ranking/src/ranker.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/ranking/src/ranker.ts)
   - Context Engine & Token Packer: [`packages/context/src/context-engine.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/context/src/context-engine.ts)
   - Code Skeleton Compressor: [`packages/compression/src/skeleton.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/compression/src/skeleton.ts)

6. **Dependency Graph & Cypher Query Engine**:
   - Directed Graph & PageRank: [`packages/graph/src/dependency-graph.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/graph/src/dependency-graph.ts)
   - Cypher Lexer, Parser & Executor: [`packages/graph/src/query/`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/graph/src/query/)

7. **Multi-Agent Rules & Exporters**:
   - Rule Engine & Conflict Detection: [`packages/rules/src/rule-engine.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/rules/src/rule-engine.ts)
   - Exporters (Claude, Cursor, Antigravity): [`packages/exporters/src/exporters.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/exporters/src/exporters.ts)

8. **Architecture Analytics (Dead Code, Cycles, Hotspots)**:
   - Analyzer: [`packages/analytics/src/analyzer.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/analytics/src/analyzer.ts)
   - Cycle Detector: [`packages/analytics/src/cycle-detector.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/analytics/src/cycle-detector.ts)
   - Dead Code Detector: [`packages/analytics/src/dead-code-detector.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/packages/analytics/src/dead-code-detector.ts)

9. **VS Code Extension & Webview Graph**:
   - Extension Entry: [`apps/vscode-extension/src/extension.ts`](file:///c:/Users/DELL/Downloads/CodeAtlas/apps/vscode-extension/src/extension.ts)
   - Webview 3D Graph App: [`apps/webview/src/App.tsx`](file:///c:/Users/DELL/Downloads/CodeAtlas/apps/webview/src/App.tsx)

---

## 8. Build, Test, and CI/CD Conventions

### Key Developer Commands

- **Install Dependencies**: `pnpm install`
- **Build All Packages**: `pnpm run build`
- **Run All Vitest Tests**: `pnpm test`
- **Run Typechecks**: `pnpm run typecheck`
- **Format Code**: `pnpm run format` (`prettier --write .`)
- **Check Formatting**: `pnpm run format:check`
- **Run Linting**: `pnpm run lint`
- **Run Changesets Versioning**: `pnpm run version-packages`
- **Publish Release**: `pnpm run release`

### Critical Rules for AI Agents

1. **Node 22 SQLite**: Never attempt to install `better-sqlite3` or external binary bindings. CodeAtlas relies exclusively on native `node:sqlite`.
2. **Lockfile Integrity**: Always run `pnpm install --no-frozen-lockfile` after adding or updating package versions or dependencies so `pnpm-lock.yaml` remains in sync with `package.json`.
3. **Prettier Compliance**: Run `pnpm run format` before finalizing commits to prevent CI `format:check` failures.
4. **Preserve Type Safety**: Never use `any` when explicit types from `@codeatlas-ai/core` or `@codeatlas-ai/shared` are available. Maintain strict null checks.
5. **Preserve Clean Boundaries**: Do not import private internal files across packages. Always export public types and functions through `src/index.ts` of each respective package.

---

## 9. Hard-Earned Lessons & CI/CD Troubleshooting Guide

This section documents exact pitfalls encountered during releases and their permanent solutions to prevent recurring bugs.

### 9.1 `ERR_PNPM_OUTDATED_LOCKFILE` in CI

- **Problem**: When package versions are bumped across `package.json` files, CI runs `pnpm install --frozen-lockfile` by default and fails if `pnpm-lock.yaml` is out of sync.
- **Permanent Solution**:
  1. Whenever modifying `package.json` or versioning packages, always execute:
     ```bash
     pnpm install --no-frozen-lockfile
     ```
  2. Stage and commit the updated `pnpm-lock.yaml` before pushing.

### 9.2 Prettier `format:check` Failures

- **Problem**: CI enforces strict Prettier code style (`prettier --check .`). If any Markdown, JSON config (e.g. `.changeset/config.json`), or TS file has styling deviations, CI immediately fails.
- **Permanent Solution**:
  1. Always run:
     ```bash
     pnpm run format
     ```
  2. Verify before pushing:
     ```bash
     pnpm run format:check
     ```

### 9.3 VS Code Extension Packaging Error (`npm error invalid: @codeatlas-ai/...`)

- **Problem**: `vsce package` executes `npm list --production` by default to validate dependencies. In a pnpm monorepo with `workspace:*` symlinks, `npm list` fails with `ELSPROBLEMS` and marks internal packages as invalid.
- **Permanent Solution**:
  1. Since `apps/vscode-extension` uses `tsup` to bundle all dependencies into a standalone `dist/extension.js`, dependencies do NOT need npm validation.
  2. Always package with `@vscode/vsce` using the `--no-dependencies` flag:
     ```bash
     cd apps/vscode-extension
     npx --yes @vscode/vsce package --no-dependencies -o ../../codeatlas-vscode.vsix
     ```

### 9.4 Changesets `fixed` Configuration (`ValidationError`)

- **Problem**: Adding the monorepo root name `"codeatlas"` into `"fixed": [["@codeatlas-ai/*", "codeatlas"]]` causes Changesets to throw a `ValidationError` because the root `package.json` is private and not a workspace package.
- **Permanent Solution**:
  - In `.changeset/config.json`, only use the published workspace glob:
    ```json
    "fixed": [
      [
        "@codeatlas-ai/*"
      ]
    ]
    ```

### 9.5 Preventing 20+ Duplicate Release Spam in GitHub Releases

- **Problem**: By default, `changesets/action@v1` creates an individual GitHub Release for each published monorepo package, cluttering the GitHub Releases tab with 20+ release entries.
- **Permanent Solution**:
  1. In `.github/workflows/publish.yml`, pass `createGithubReleases: false` to `changesets/action@v1`.
  2. Single, unified GitHub releases with `.vsix` installer assets are handled by `.github/workflows/release.yml` when a `v*` tag is pushed.

### 9.6 Private Packages Version Synchronization

- **Problem**: Packages marked `"private": true` (`apps/vscode-extension`, `apps/jetbrains-plugin`, `apps/neovim-plugin`) are intentionally ignored by Changesets.
- **Permanent Solution**:
  - Whenever performing a version bump (e.g., to `v0.2.0`), manually update the `version` field in:
    - `apps/vscode-extension/package.json`
    - `apps/jetbrains-plugin/build.gradle.kts`
    - `apps/neovim-plugin/package.json`
    - `apps/cli/src/index.ts` (`program.version('0.2.0')`)
    - `packages/mcp/src/mcp-server.ts` (`serverInfo.version: '0.2.0'`)

### 9.7 Internal AI Context Privacy

- **Rule**: `PROJECT_CONTEXT.md` is strictly maintained for local coding agents and must remain in `.gitignore` to avoid cluttering public git commits.

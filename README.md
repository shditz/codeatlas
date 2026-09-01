<div align="center">
  <img src="assets/banner.jpg" alt="CodeAtlas Banner" width="100%" />
</div>

# CodeAtlas 🗺️

> **Deterministic Context Intelligence & Architecture Graph Engine for AI Coding Agents**

CodeAtlas turns any codebase into a high-performance **Knowledge Graph** stored locally in SQLite (`.atlas/atlas.db`). It equips AI coding assistants (**Google Antigravity**, **Claude Code**, **Cursor**, **Windsurf**, **Copilot**) with precise architectural context—preventing hallucinated imports, blocking structural regressions, and grounding code generation in live dependency trees.

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/shditz.codeatlas-official?logo=visual-studio-code&label=VS%20Code%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=shditz.codeatlas-official)
[![CI](https://github.com/shditz/codeatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/shditz/codeatlas/actions)
[![Tests: 166 passing](<https://img.shields.io/badge/Tests-166%20passing%20(100%25)-brightgreen.svg>)](https://github.com/shditz/codeatlas)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript 5.x](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js >=20](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green?logo=node.js)](https://nodejs.org/)

---

## ⚡ Quick Install

### 1. VS Code / Cursor / Windsurf Extension (1-Click Install)

Install directly from the official **Visual Studio Marketplace**:

- **Via Marketplace:** Search for [**`CodeAtlas`**](https://marketplace.visualstudio.com/items?itemName=shditz.codeatlas-official) (`shditz.codeatlas-official`) in your editor's Extensions tab (`Ctrl+Shift+X` / `Cmd+Shift+X`).
- **Via Terminal:**
  ```bash
  code --install-extension shditz.codeatlas-official
  ```
  _(For Cursor: `cursor --install-extension shditz.codeatlas-official`)_

### 2. Global CLI Installation

```bash
npm install -g @codeatlas-ai/cli
```

### 3. Connect to Your AI Assistant (1-Click MCP Setup)

In your project directory, automatically wire CodeAtlas to Cursor, Claude, Antigravity, and Windsurf:

```bash
atlas mcp setup --all
```

---

## 🚀 Why Developers & AI Agents Need CodeAtlas

When AI coding agents edit complex repositories, they hit two major walls:

1. **Context Blindness**: LLMs don't know your dependency graph, leading to wrong imports, circular dependencies, and breaking changes in distant files.
2. **Context Window Saturation**: Stuffing raw, full files into LLM prompts wastes 80–90% of token budgets on irrelevant boilerplate and dilutes attention.

```
┌─────────────────┐       AST & Semantics       ┌────────────────────────┐
│  Source Code    │ ──────────────────────────> │   CodeAtlas Engine     │
│  (Disk / Git)   │ <────────────────────────── │ (.atlas/atlas.db)      │
└─────────────────┘   Auto Linter & QuickFix    └───────────┬────────────┘
                                                            │
                            ┌───────────────────────────────┴───────────────────────────────┐
                            ▼                                                               ▼
             ┌─────────────────────────────┐                                 ┌─────────────────────────────┐
             │    VS Code / Cursor IDE     │                                 │     AI Coding Assistants    │
             │  • 2D/3D WebGL Canvas       │                                 │  • 16 Native MCP Tools      │
             │  • 7-Mode Architecture Map  │                                 │  • Live DAG Rules Sync      │
             │  • Live Blast Radius Status │                                 │  • Skeletonized AST Prompts │
             │  • CodeLens Graph Spotlight │                                 │  • 92% Token Savings        │
             └─────────────────────────────┘                                 └─────────────────────────────┘
```

---

## 🌟 Key Capabilities

### 🎨 1. Interactive 2D/3D WebGL Architecture Visualizer

Launch a high-performance force-directed canvas directly in your editor sidebar or main tab with **7 specialized heatmap modes**:

- 🔤 **Language:** Syntax distribution across your monorepo.
- 📦 **Cluster:** Modular domain boundaries derived from Louvain graph clustering.
- 📈 **Git Churn:** Identify files with frequent commits and high turbulence.
- ⚠️ **Instability:** Robert C. Martin's instability metric ($I = \frac{C_e}{C_a + C_e}$) highlighting fragile modules.
- 🔥 **Blast Radius:** Highlight caller cascades and downstream impact severity.
- 💣 **Debt Hotspot:** Multi-factor metric combining cyclomatic complexity, churn, and instability.
- 📏 **Lines of Code:** Spot monolithic god-files instantly.

### ⚡ 2. CodeLens "Explain with Graph" & Live Blast Radius

- **CodeLens Spotlight:** Click `⚡ Explain with Graph` above any function, class, or interface to zoom the 3D canvas straight into its local call graph.
- **Real-time Status Bar Telemetry:** Instant `$(flame) Blast: X files (RISK)` badge in the status bar. Click for a detailed QuickPick breakdown and 1-click copyable prompt for AI agents.

### 🔄 3. Automated AI Rules & Architecture Blueprint Sync

CodeAtlas injects a live topological blueprint of your codebase between marker comments in `.cursorrules`, `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md`:

```markdown
<!-- CODEATLAS:START_ARCHITECTURE_MAP -->

# 🗺️ Codebase Architecture & Domain Blueprint (Auto-generated by CodeAtlas)

- Total Files: 285 | Total Symbols: 1027 | Dependencies: 590
- Circular Dependency Health: Clean (0 cycles)
- Top Core Hubs (PageRank): packages/core, packages/storage, packages/parser
  ...

<!-- CODEATLAS:END_ARCHITECTURE_MAP -->
```

Run `CodeAtlas: Sync AI Rules & Architecture Map` to update this blueprint automatically without overwriting custom prompt instructions.

### 🛡️ 4. AI Linter Guard & Auto-Repair QuickFix

- Detects circular import cycles (via Tarjan's SCC algorithm) and Domain-Driven Design (DDD) layer regressions in real time.
- Provides QuickFix suggestions (`Ctrl+.`) with automated interface extraction recommendations.

### 🏢 5. Multi-Repo & Microservices Global Mesh Aggregator

- Aggregates monorepo subpackages and polyrepos into a unified global mesh.
- Automatically links backend HTTP endpoints (e.g. `GET /api/users/:id`) to client fetch/axios callers across separate repositories.

### 🔒 6. Zero-Leak Security & Automatic Secret Redaction

- Built-in `SecretScanner` intercepts file buffers before indexing.
- Cloud credentials (AWS, GCP, Azure, OpenAI), JWT tokens, and database connection strings are replaced with safe masks (`[REDACTED_SECRET]`) before touching SQLite or MCP context payloads.

---

## 🌐 Universal Language & Parser Matrix

CodeAtlas uses native **Tree-sitter** grammars and semantic resolver pipelines:

| Tier                         | Language / Framework     | Extensions                       | Extracted Entities & Graph Semantics                                        |
| :--------------------------- | :----------------------- | :------------------------------- | :-------------------------------------------------------------------------- |
| **Tier 1 (AST & Semantics)** | **TypeScript / TSX**     | `.ts`, `.tsx`, `.mts`, `.cts`    | Type Inheritance, `@/*` Path Mappings, React Hooks, Next.js App Router      |
|                              | **JavaScript / JSX**     | `.js`, `.jsx`, `.mjs`, `.cjs`    | ES Imports, CommonJS, Functions, Classes, JSX Components                    |
|                              | **NestJS**               | `.ts`                            | Controllers (`@Controller`), Providers (`@Injectable`), Modules (`@Module`) |
|                              | **Prisma**               | `.prisma`                        | Models, Relations, Enums, Database Foreign Key Graph                        |
|                              | **Python**               | `.py`                            | Classes, Methods, Functions, Module Imports (`from x import y`)             |
|                              | **Go**                   | `.go`                            | Structs, Interfaces, Methods, Functions, Package Imports                    |
|                              | **Rust**                 | `.rs`                            | Structs, Enums, Traits, `impl` blocks, `use` declarations                   |
|                              | **Dart / Flutter**       | `.dart`                          | Classes, Mixins, Async Methods, Package Imports                             |
|                              | **Scala**                | `.scala`, `.sc`                  | Case Classes, Traits, Companion Objects, Package Imports                    |
|                              | **Lua**                  | `.lua`                           | Modules, Functions, Methods, `require(...)` Calls                           |
|                              | **Elixir & Erlang**      | `.ex`, `.exs`, `.erl`            | Modules, Functions, Includes, Aliases                                       |
|                              | **Zig**                  | `.zig`                           | Structs, Public Functions, `@import(...)`                                   |
|                              | **GraphQL**              | `.graphql`, `.gql`               | Types, Inputs, Interfaces, Queries, Mutations                               |
|                              | **Vue / Svelte / Astro** | `.vue`, `.svelte`, `.astro`      | Script AST Extraction, Component Symbols, Relative Imports                  |
|                              | **SQL Schemas**          | `.sql`                           | Table Definitions, Views, Stored Procedures                                 |
| **Tier 2 (Structural)**      | **Java & C#**            | `.java`, `.cs`                   | Classes, Interfaces, Methods, Namespaces, Imports                           |
|                              | **C / C++**              | `.c`, `.cpp`, `.h`, `.hpp`       | Functions, Structs, Classes, Header Includes                                |
|                              | **PHP / Ruby / Kotlin**  | `.php`, `.rb`, `.kt`             | Classes, Modules, Functions, Namespaces                                     |
| **Tier 3 (Search & Data)**   | **Config & Docs**        | `.json`, `.yaml`, `.toml`, `.md` | SQLite FTS5 BM25 Full-Text Search & Token Counting                          |

---

## 📊 Empirical Benchmarks

Tested on open-source repositories to measure context accuracy, recall, and token reduction:

### 📦 Dataset: `expressjs/express` (96 files, 71k raw tokens)

| Task Scenario                       | Target Ground Truth                                    | Retrieval Recall | Context Tokens |  Token Savings  | Latency  |
| :---------------------------------- | :----------------------------------------------------- | :--------------: | :------------: | :-------------: | :------: |
| **Routing & Dispatching**           | `lib/application.js`, `lib/express.js`                 |     **100%**     |     6,364      |     **91%**     |   26ms   |
| **Server Bootstrap (`app.listen`)** | `lib/application.js`, `lib/express.js`                 |     **50%**      |     4,555      |     **94%**     |   32ms   |
| **JSON Response Serialization**     | `lib/response.js`                                      |     **100%**     |     5,124      |     **93%**     |   56ms   |
| **Request Cookie & Header Parsing** | `lib/request.js`                                       |     **100%**     |     6,285      |     **91%**     |   17ms   |
| **View Engine Resolution**          | `lib/view.js`, `lib/application.js`, `lib/response.js` |     **67%**      |     6,344      |     **91%**     |   59ms   |
| **Overall Empirical Average**       | —                                                      |  **83% Recall**  |       —        | **92% Savings** | **38ms** |

---

## 🛠️ CLI Reference

```bash
# Initialize and index your project
atlas init                     # Auto-detects stack and creates .atlas/ folder
atlas index                    # Builds AST symbols, dependencies, and graph in SQLite
atlas watch                    # Incremental real-time graph watcher

# Quality & Architecture Audits
atlas analyze --architecture   # Validates DDD layers and circular dependencies
atlas diff                     # Computes semantic blast radius from current Git diff
atlas doctor                   # Runs repository health checks

# AI Guidelines & Context
atlas rules generate all -y    # Generates AGENTS.md, CLAUDE.md, .cursorrules
atlas context --intent bug     # Builds token-budgeted prompt pack skeleton
atlas export                   # Exports context packs for manual LLM sessions

# Model Context Protocol (MCP)
atlas mcp setup --all          # 1-click config for all detected AI assistants
atlas mcp                      # Runs stdio MCP server with 16 tools
```

---

## 🧰 The 16 CodeAtlas MCP Tools

AI assistants equipped with CodeAtlas can autonomously call these tools:

| Tool Name                        | Purpose                                                                       |
| :------------------------------- | :---------------------------------------------------------------------------- |
| `atlas_trace_execution_path`     | Traces call chains upwards to entry points or downwards to leaf dependencies. |
| `atlas_calculate_change_surface` | Calculates cascading blast radius before making risky modifications.          |
| `atlas_plan_feature`             | Produces an evidence-based multi-file implementation roadmap.                 |
| `atlas_security_audit`           | Runs SAST security taint analysis and secret detection.                       |
| `atlas_analyze`                  | Audits DDD layer regressions, circular imports, and dead code.                |
| `atlas_get_context`              | Delivers intent-tailored, token-optimized context packs.                      |
| `atlas_compress`                 | Generates token-compressed AST skeletons with redacted secrets.               |
| `atlas_graph_query`              | Traverses the dependency graph using Cypher / graph queries.                  |
| `atlas_search`                   | BM25 full-text search with synonym query expansion.                           |
| `atlas_pr_diff`                  | Evaluates Git diffs and outputs PR architectural impact reports.              |
| `atlas_find_entry_points`        | Discovers controllers, routes, CLI handlers, and public APIs.                 |
| `atlas_get_map`                  | Returns an ASCII directory and exported symbol tree.                          |
| `atlas_get_rules`                | Discovers and validates active AI coding rules.                               |
| `atlas_doctor`                   | Checks SQLite database integrity and repository readiness.                    |
| `atlas_scan`                     | Quick workspace metadata scan without indexing.                               |
| `atlas_index`                    | Triggers background AST indexing and graph updates.                           |

---

## ⚙️ Configuration (`.atlas/config.toml`)

```toml
[project]
name = "MyProject"

[index]
follow_symlinks = false
include_tests = true
max_file_size = 1048576

[context]
max_tokens = 12000
default_mode = "full" # "full", "signature", "summary", "digest"

[security]
scan_secrets = true
exclude_patterns = [".env", "*.pem", "*.key"]

[architecture.rules.disallow]
"presentation -> infrastructure" = "Controllers must not directly call Repositories without Services"
"domain -> infrastructure" = "Domain entities must maintain Dependency Inversion"
```

---

## 📖 Web Documentation

To run the interactive VitePress documentation portal locally:

```bash
pnpm --filter @codeatlas-ai/docs docs:dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📄 License

MIT © 2026-present CodeAtlas Contributors.

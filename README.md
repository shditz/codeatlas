<div align="center">
  <img src="assets/banner.jpg" alt="CodeAtlas Banner" width="100%" />
</div>

# CodeAtlas

> Local dependency graphs and context intelligence for AI coding agents.

CodeAtlas indexes your codebase into a local SQLite database (`.atlas/atlas.db`), mapping relationships between files, functions, classes, and packages. It connects to AI coding assistants (**Google Antigravity**, **Claude Code**, **Cursor**, **Windsurf**, **Copilot**) via the Model Context Protocol (MCP) and editor extensions, giving them the architectural context needed to edit large repositories without hallucinating imports or breaking downstream dependencies.

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/shditz.codeatlas-official?logo=visual-studio-code&label=VS%20Code%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=shditz.codeatlas-official)
[![CI](https://github.com/shditz/codeatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/shditz/codeatlas/actions)
[![npm version](https://img.shields.io/npm/v/@codeatlas-ai/cli?color=blue)](https://www.npmjs.com/package/@codeatlas-ai/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green?logo=node.js)](https://nodejs.org/)

---

## Why CodeAtlas?

AI coding models are effective at writing code within a single file, but they are context-blind to repository-wide architecture. When editing mid-to-large codebases, they frequently:

- Import modules that do not exist or bypass public boundaries.
- Introduce circular dependencies between packages.
- Miss downstream callers that break when a function signature changes.
- Waste 80–90% of prompt token budgets on irrelevant file boilerplate.

CodeAtlas builds a local directed graph of your repository so both developers and AI assistants can answer:

- **What files will break if I change this function?**
- **Where is this endpoint or service actually consumed?**
- **Which modules have circular dependencies or layer violations?**
- **What is the minimum necessary context for this task?**

All indexing runs locally. Source code never leaves your machine.

---

## Example

When you modify a file in your project:

```bash
atlas diff
```

CodeAtlas inspects the change surface against the dependency graph:

```text
Target: packages/storage/src/search.ts

Direct Dependents (1-hop):
  packages/retrieval/src/retrieval-engine.ts
  packages/mcp/src/mcp-server.ts

Transitive Impact (2-hop):
  apps/cli/src/commands/search.ts
  apps/vscode-extension/src/extension.ts

Risk Level: MEDIUM (4 downstream files affected)
Architecture Health: Clean (0 circular dependencies, 0 layer leaks)
```

AI assistants query this graph before editing, allowing them to verify downstream callers and maintain modular boundaries.

---

## Quickstart

### 1. Install the CLI

```bash
npm install -g @codeatlas-ai/cli
```

### 2. Index Your Project

Navigate to your project root:

```bash
# Detect project stack and create local .atlas/ directory
atlas init

# Parse AST structures and build the local dependency graph
atlas index
```

### 3. Connect to Your AI Assistant

Automatically configure MCP for all detected tools (**Cursor**, **Claude Code**, **Antigravity**, **Windsurf**):

```bash
atlas mcp setup --all
```

---

## VS Code & Cursor Extension

CodeAtlas provides an official extension for VS Code, Cursor, and Windsurf featuring an interactive 2D/3D architecture canvas, real-time blast radius monitoring, and CodeLens navigation.

- **Marketplace:** Search for [**`CodeAtlas`** (`shditz.codeatlas-official`)](https://marketplace.visualstudio.com/items?itemName=shditz.codeatlas-official) in the Extensions tab (`Ctrl+Shift+X` / `Cmd+Shift+X`).
- **Terminal:**
  ```bash
  code --install-extension shditz.codeatlas-official
  ```
  _(For Cursor: `cursor --install-extension shditz.codeatlas-official`)_

---

## How It Works

```
┌─────────────────┐        AST & Imports        ┌────────────────────────┐
│  Source Code    │ ──────────────────────────> │   CodeAtlas Engine     │
│  (Local Disk)   │                             │   (.atlas/atlas.db)    │
└─────────────────┘                             └───────────┬────────────┘
                                                            │
                            ┌───────────────────────────────┴───────────────────────────────┐
                            ▼                                                               ▼
             ┌─────────────────────────────┐                                 ┌─────────────────────────────┐
             │    VS Code / Cursor IDE     │                                 │     AI Coding Assistants    │
             │  • 2D/3D WebGL Graph Canvas │                                 │  • 16 Model Context Tools   │
             │  • Live Blast Radius Status │                                 │  • Live Architecture Rules  │
             │  • CodeLens Navigation      │                                 │  • Skeletonized AST Prompts │
             │  • Diagnostics & QuickFix   │                                 │  • Token Budget Packing     │
             └─────────────────────────────┘                                 └─────────────────────────────┘
```

1. **AST Extraction & Secret Redaction**: Parses source files using Tree-sitter grammars. Built-in filters redact API keys, JWTs, and credentials before data is stored or passed to context.
2. **Semantic Resolution**: Resolves relative imports, path aliases (`@/*`), and class/interface inheritance hierarchies (`extends` / `implements`).
3. **Graph Storage & Metrics**: Stores symbols and dependency edges in SQLite. Computes PageRank, modularity clusters, instability metrics, and circular dependency chains.
4. **Context & MCP Delivery**: Exposes 16 Model Context Protocol (MCP) tools and updates architecture rules for `.cursor/rules/`, `CLAUDE.md`, and `AGENTS.md`.

---

## Language Support

CodeAtlas parses ASTs and resolves dependencies across common programming languages:

| Category                 | Languages / Frameworks                                                                                                            | Supported File Extensions                                                                                                                               |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Full AST & Semantics** | TypeScript, JavaScript, Python, Go, Rust, Dart, Scala, Lua, Elixir, Erlang, Zig, GraphQL, Vue, Svelte, Astro, SQL, NestJS, Prisma | `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rs`, `.dart`, `.scala`, `.lua`, `.ex`, `.zig`, `.graphql`, `.vue`, `.svelte`, `.astro`, `.sql`, `.prisma` |
| **Structural Analysis**  | Java, C#, C, C++, PHP, Ruby, Kotlin, Swift                                                                                        | `.java`, `.cs`, `.c`, `.cpp`, `.h`, `.hpp`, `.php`, `.rb`, `.kt`, `.swift`                                                                              |
| **Content & Search**     | JSON, YAML, TOML, Markdown, Dockerfile                                                                                            | `.json`, `.yaml`, `.toml`, `.md`, `Dockerfile`                                                                                                          |

_For complete parser capabilities and framework adapters, see the [Language Support Guide](apps/docs/guide/parser.md)._

---

## CLI Reference

| Command                | Description                                                                           |
| :--------------------- | :------------------------------------------------------------------------------------ |
| `atlas init`           | Initializes `.atlas/` folder and project configuration.                               |
| `atlas index`          | Parses ASTs, computes metrics, and updates local SQLite graph.                        |
| `atlas watch`          | Watches for file changes and updates the graph incrementally.                         |
| `atlas diff`           | Calculates semantic blast radius and risk ratings from Git diffs.                     |
| `atlas analyze`        | Audits Domain-Driven Design (DDD) layers, circular dependencies, and dead code.       |
| `atlas doctor`         | Runs integrity checks on the SQLite database and repository health.                   |
| `atlas rules generate` | Generates evidence-based guidelines (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`).     |
| `atlas context`        | Builds token-budgeted prompt packs tailored to intent (`bug`, `feature`, `refactor`). |
| `atlas search`         | Performs full-text search with synonym query expansion via SQLite FTS5.               |
| `atlas mcp setup`      | Configures detected AI coding assistants to connect to CodeAtlas MCP.                 |
| `atlas mcp`            | Runs the Model Context Protocol (MCP) server over `stdio`.                            |

_For full CLI flags and examples, see the [CLI Documentation](apps/docs/guide/cli.md)._

---

## Model Context Protocol (MCP)

CodeAtlas implements **16 native MCP tools** enabling AI assistants to explore codebases autonomously:

- **Graph & Navigation:** `atlas_trace_execution_path`, `atlas_calculate_change_surface`, `atlas_find_entry_points`, `atlas_graph_query`
- **Context & Optimization:** `atlas_get_context`, `atlas_compress`, `atlas_search`, `atlas_get_map`
- **Architecture & Quality:** `atlas_analyze`, `atlas_security_audit`, `atlas_plan_feature`, `atlas_pr_diff`, `atlas_get_rules`
- **Repository Operations:** `atlas_doctor`, `atlas_scan`, `atlas_index`

### Manual Setup

#### Google Antigravity & Codex (`.agents/mcp_config.json`)

```json
{
  "mcpServers": {
    "codeatlas": {
      "command": "atlas",
      "args": ["mcp"]
    }
  }
}
```

#### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "codeatlas": {
      "command": "atlas",
      "args": ["mcp"]
    }
  }
}
```

#### Claude Code CLI

```bash
claude mcp add codeatlas atlas -- mcp
```

_For detailed MCP tool definitions, see the [MCP Documentation](apps/docs/guide/mcp.md)._

---

## Repository Structure

```
codeatlas/
├── packages/
│   ├── core/           # Data models, configuration, and secret redaction
│   ├── parser/         # Tree-sitter parsers, framework adapters, TS semantic resolver
│   ├── storage/        # SQLite persistence and FTS5 search
│   ├── graph/          # Directed graph engine, PageRank, cycle detection
│   ├── analytics/      # Architecture analysis, DDD layers, multi-repo aggregation
│   ├── rules/          # Rule generator and live DAG blueprint synchronization
│   ├── retrieval/      # Multi-source retrieval engine (FTS5 + Graph)
│   ├── compression/    # AST skeletonization and prompt token compression
│   ├── ranking/        # Relevance ranking and scoring algorithms
│   ├── context/        # Context pack assembly and token budget management
│   ├── mcp/            # Model Context Protocol server (16 tools) & configurator
│   ├── git/            # Git service for commit churn and diff analysis
│   ├── llm/            # LLM provider abstractions
│   ├── shared/         # Common utilities, logger, and error types
│   ├── github-action/  # CI/CD architecture quality gate action
│   └── benchmark/      # Recall and token reduction benchmark suite
├── apps/
│   ├── cli/            # Standalone `atlas` command-line executable
│   ├── vscode-extension/# Official VS Code / Cursor extension
│   ├── webview/        # WebGL force-directed graph canvas
│   ├── docs/           # VitePress documentation portal
│   └── mcp-server/     # Standalone MCP binary runner
```

---

## Benchmarks

Evaluated against open-source repositories to measure context accuracy, recall, and token reduction:

### Dataset: `expressjs/express` (96 files, 71k raw tokens)

| Task Scenario                       | Target Ground Truth                                    |  Recall  | Context Tokens | Token Savings | Latency  |
| :---------------------------------- | :----------------------------------------------------- | :------: | :------------: | :-----------: | :------: |
| **Routing & Dispatching**           | `lib/application.js`, `lib/express.js`                 | **100%** |     6,364      |    **91%**    |   26ms   |
| **Server Bootstrap (`app.listen`)** | `lib/application.js`, `lib/express.js`                 | **50%**  |     4,555      |    **94%**    |   32ms   |
| **JSON Response Serialization**     | `lib/response.js`                                      | **100%** |     5,124      |    **93%**    |   56ms   |
| **Request Cookie & Header Parsing** | `lib/request.js`                                       | **100%** |     6,285      |    **91%**    |   17ms   |
| **View Engine Resolution**          | `lib/view.js`, `lib/application.js`, `lib/response.js` | **67%**  |     6,344      |    **91%**    |   59ms   |
| **Overall Average**                 | —                                                      | **83%**  |       —        |    **92%**    | **38ms** |

_Benchmark run on Intel Core i5-8350U @ 3.60GHz, 16GB RAM, Node.js v22. Results reflect fixed scenario queries evaluated against golden file sets._

---

## Documentation

Comprehensive guides and API references are available in the documentation portal:

- [Getting Started](apps/docs/guide/getting-started.md)
- [CLI Reference](apps/docs/guide/cli.md)
- [Model Context Protocol (MCP)](apps/docs/guide/mcp.md)
- [VS Code Extension Guide](apps/docs/guide/vscode.md)
- [Architecture & Storage Internals](apps/docs/guide/architecture.md)
- [Language & Parser Matrix](apps/docs/guide/parser.md)
- [AI Rules Synchronization](apps/docs/guide/rules-export.md)

To run the documentation portal locally:

```bash
pnpm --filter @codeatlas-ai/docs docs:dev
```

---

## Local Development

```bash
# Clone repository
git clone https://github.com/shditz/codeatlas.git
cd codeatlas

# Install dependencies
pnpm install

# Build all packages and applications
pnpm build

# Run test suite
pnpm test

# Typecheck and lint
pnpm typecheck
pnpm lint
```

---

## License

MIT © 2026-present CodeAtlas Contributors.

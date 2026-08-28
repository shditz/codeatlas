# CodeAtlas

> **Give AI a map of your codebase.**  
> Local-first context intelligence and architecture platform for AI coding agents.

[![CI](https://github.com/shditz/codeatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/shditz/codeatlas/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.0.0-green?logo=node.js)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-73%2F73%20Passed-success?logo=vitest)](https://vitest.dev)
[![Local First](https://img.shields.io/badge/Privacy-100%25%20Local-success)](https://github.com/shditz/codeatlas)

---

## 💡 What is CodeAtlas?

**CodeAtlas** is a high-performance, privacy-first context engine and code intelligence platform. It parses software repositories locally into an SQLite knowledge graph, retrieves task-relevant files and dependencies with multi-signal semantic search, and packs progressive context tailored for LLMs and AI coding agents.

CodeAtlas is **not** an AI chat assistant—it is the **context layer** that makes all AI coding tools (Cursor, Claude, Antigravity, Copilot, DeepSeek, Trae, Qwen, Kimi, and Grok) substantially faster, more accurate, and token-efficient.

---

## 🚀 How It Works

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐     ┌────────────────┐
│   Source Code   │ ──> │ Tree-Sitter AST  │ ──> │ SQLite Knowledge DB │ ──> │ FTS5 + Graph   │
│   (Local-First) │     │ & Symbol Parsing │     │ (.atlas/atlas.db)   │     │ Multi-Signal   │
└─────────────────┘     └──────────────────┘     └─────────────────────┘     └────────────────┘
                                                                                      │
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐              │
│    AI Coding    │ <── │ Export Formatter │ <── │ Token Optimization  │ <────────────┘
│      Agent      │     │ (Multi-Target)   │     │ (Progressive Mode)  │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

1. **Scan & Parse**: Discovers project structures and parses AST symbols, imports, and exports using Tree-sitter.
2. **Index**: Stores files, symbols, dependency edges, and full-text search indices in local SQLite (`.atlas/atlas.db`).
3. **Retrieve**: Combines SQLite FTS5 lexical matching, path heuristics, and dependency graph expansion with architectural centrality scoring.
4. **Progressive Compression**: Automatically allocates token budgets, delivering full source for primary targets and semantic skeletons/signatures for deep dependencies.
5. **Multi-Agent Export**: Emits zero-conflict, formatted context packs for any target AI coding assistant.

---

## ✨ Key Features

### 🔍 Deep Code Intelligence

- AST parsing for **TypeScript, JavaScript, Python, Go, and Rust**.
- Universal full-text indexing supporting **all programming languages and file formats** (PHP, CSS, HTML, Vue, Svelte, Ruby, C++, Markdown, etc.).
- Symbol extraction (classes, methods, functions, interfaces, types, enums, exports).
- Comprehensive dependency graph resolution.

### 🧠 Smart Multi-Signal Retrieval

- **SQLite FTS5 Full-Text Search**: Fast BM25-ranked keyword retrieval across source files.
- **Architectural Centrality Scoring**: Prioritizes core modules with high inbound dependency counts.
- **Graph Expansion**: Recursively retrieves 1-hop and 2-hop dependencies and dependents.
- **Symbol Matching**: Directly scores files matching query symbol signatures.

### 🎛️ Progressive Context & Token Budgeting

- Configurable token budgets (e.g. 4k, 8k, 16k, 32k tokens).
- Dynamic mode downgrade: `full` ➔ `signature` (skeleton) ➔ `digest` (summary) to fit maximum architectural depth within budget.
- Automatic rule discovery (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, Cursor rules, Copilot instructions).

### 🌐 Graph Query Engine & Natural Language (NL2Cypher)

- Query your codebase like a graph database directly inside VS Code, CLI, or MCP:
  ```cypher
  MATCH (f:File)-[r:IMPORTS]->(b:File) RETURN f.name, b.name
  MATCH (s:Symbol {kind: 'function'}) RETURN s.name, s.file
  ```
- **Natural Language Translation**: Ask questions in plain English or Indonesian, and CodeAtlas auto-translates them to Cypher queries:
  ```bash
  atlas query "semua file typescript"
  atlas query "who calls handleLogin"
  atlas query "which files import parser"
  ```

### 🔬 Deep Architecture Analytics (`atlas analyze`)

- **Circular Dependency Detection**: Identifies single and multi-hop import cycles before they break production.
- **Dead Code Detection**: Discovers orphaned source files and unreferenced symbols with 0 incoming dependencies.
- **Hotspots & Coupling Metrics**: Computes Fan-in, Fan-out, Instability ($I$), and detects God Objects.

### 🔒 Local-First Privacy Guarantee

- **100% Offline**: All parsing, indexing, and querying run entirely on your local machine.
- **Zero Telemetry**: No tracking, no data collection, no code leaves your device.
- **Ignore Rules**: Honors `.gitignore` and custom `.atlasignore` patterns.

---

## 📦 Supported Export Targets

CodeAtlas exports structured context packs for all major AI coding platforms:

| Target        | Description                    | Output Format / Destination        |
| :------------ | :----------------------------- | :--------------------------------- |
| `cursor`      | Cursor IDE rules & context     | `.cursorrules` / Clipboard         |
| `claude`      | Anthropic Claude Projects      | `CLAUDE.atlas.md` / Clipboard      |
| `antigravity` | Antigravity AI IDE / Agent     | Context Pack injection / Clipboard |
| `copilot`     | GitHub Copilot instructions    | `.github/copilot-instructions.md`  |
| `gemini`      | Google Gemini CLI / Studio     | `GEMINI.atlas.md` / Clipboard      |
| `deepseek`    | DeepSeek AI coder              | `DEEPSEEK.atlas.md` / Clipboard    |
| `trae`        | Trae IDE instructions          | `TRAE.atlas.md` / Clipboard        |
| `qwen`        | Qwen / Tongyi Lingma           | `QWEN.atlas.md` / Clipboard        |
| `kimi`        | Kimi / Moonshot AI             | `KIMI.atlas.md` / Clipboard        |
| `grok`        | xAI Grok coding context        | `GROK.atlas.md` / Clipboard        |
| `markdown`    | Generic Markdown documentation | Standard Markdown                  |

---

## 💻 User Guide & Features

### 1. 🖥️ VS Code Extension

The official CodeAtlas VS Code extension provides a visual interface and integrated commands for your editor.

#### Available Commands (Command Palette: `Ctrl+Shift+P` / `Cmd+Shift+P`)

| Command                                      | Description                                                               | How to Use                                                             |
| :------------------------------------------- | :------------------------------------------------------------------------ | :--------------------------------------------------------------------- |
| **`CodeAtlas: Index / Refresh Codebase`**    | Scans the workspace, parses AST symbols, and generates `.atlas/atlas.db`. | Run once on a new workspace or after major codebase changes.           |
| **`CodeAtlas: Export Context for AI Agent`** | Builds a smart, token-budgeted context pack matching your task.           | Run command, type task description, and select target AI agent format. |
| **`CodeAtlas: Run Cypher Graph Query`**      | Executes relational graph queries across files and symbols.               | Choose from smart presets or type custom Cypher/NL query.              |
| **`CodeAtlas: Generate Git PR Context`**     | Analyzes git diff against a base branch to produce PR review context.     | Select base branch (e.g. `main`), and CodeAtlas maps affected files.   |
| **`CodeAtlas: Toggle Real-time Watcher`**    | Automatically updates the index on file save (`Ctrl+S`).                  | Run to toggle the background file watcher on/off.                      |

---

### 2. ⌨️ Command-Line Interface (CLI)

The `@codeatlas/cli` provides full headless operation for terminal workflows, automated scripts, and CI/CD pipelines.

```bash
# Global installation
pnpm install -g @codeatlas/cli

# 1. Initialize CodeAtlas in current project
atlas init

# 2. Build or refresh local index
atlas index

# 3. Deep architectural analysis (dead code, cycles, hotspots)
atlas analyze

# 4. Natural language & Cypher graph queries
atlas query "who calls executeQuery"
atlas query "MATCH (f:File {language: 'typescript'}) RETURN f.name"

# 5. Generate context pack for a specific coding task
atlas context "implement OAuth2 refresh flow" --budget 8000

# 6. Realtime incremental watcher
atlas watch
```

#### CLI Command Reference

| Command                | Options                                           | Description                                                       |
| :--------------------- | :------------------------------------------------ | :---------------------------------------------------------------- |
| `atlas init`           | `--force`                                         | Initializes `.atlas/config.toml` in the repository root.          |
| `atlas scan`           | `--json`                                          | Detects languages, package managers, and directory structures.    |
| `atlas index`          | `--watch`                                         | Parses files and builds `.atlas/atlas.db` SQLite knowledge graph. |
| `atlas analyze`        | `--cycles`, `--dead-code`, `--hotspots`, `--json` | Runs deep architectural analysis (cycles, dead code, coupling).   |
| `atlas query <query>`  | `-n, --nl`, `--json`                              | Executes Cypher queries or plain natural language graph search.   |
| `atlas search <query>` | `--limit <n>`                                     | Performs full-text BM25 search across source code.                |
| `atlas context <task>` | `--target <t>`, `--budget <n>`                    | Builds an optimized context pack for the specified task.          |
| `atlas export`         | `--target <t>`, `--output <f>`                    | Writes agent instructions to target configuration files.          |
| `atlas watch`          | —                                                 | Starts background watcher for incremental real-time indexing.     |
| `atlas rules list`     | `--all`                                           | Displays discovered AI instruction rules.                         |
| `atlas rules validate` | —                                                 | Checks for conflicting rules (e.g. tabs vs spaces).               |

---

### 3. 🤖 GitHub Actions CI/CD Integration

Automate codebase context generation and PR reviews in your CI/CD pipelines with `@codeatlas/github-action`:

```yaml
name: CodeAtlas PR Context
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  context:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: codeatlas/codeatlas/packages/github-action@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          base-branch: 'main'
          target-agent: 'cursor'
          token-budget: '8000'
          post-comment: 'true'
```

---

### 4. 🧩 IDE Plugins: Neovim & JetBrains

- **Neovim Plugin** (`apps/neovim-plugin`): Complete Lua integration with `:CodeAtlasIndex`, `:CodeAtlasAnalyze`, `:CodeAtlasQuery`, and `:CodeAtlasContext` in floating windows.
- **JetBrains / IntelliJ Plugin** (`apps/jetbrains-plugin`): Native action group and tools menu integration for WebStorm, IntelliJ IDEA, PyCharm, and GoLand.

---

### 5. 🔌 Model Context Protocol (MCP) Server

CodeAtlas implements the **Model Context Protocol (MCP)**, enabling LLMs in Claude Desktop, Cursor, or Antigravity to autonomously query your codebase.

#### Available MCP Tools

- **`atlas_search`**: Performs BM25 full-text keyword retrieval across all indexed files.
- **`atlas_get_context`**: Generates a task-relevant context pack within a token budget.
- **`atlas_graph_query`**: Executes Cypher or natural language queries against the dependency graph.
- **`atlas_analyze`**: Analyzes architectural health, circular dependencies, and dead code.
- **`atlas_pr_diff`**: Analyzes git branch diffs with architectural impact mapping.
- **`atlas_compress`**: Compresses source code into AST skeletons and signatures.

---

## 🏗️ Monorepo Architecture

```text
codeatlas/
├── apps/
│   ├── cli/                 # Command-line interface (Commander.js)
│   ├── mcp-server/          # Standalone MCP Server entrypoint
│   ├── vscode-extension/    # Official VS Code extension
│   ├── neovim-plugin/       # Neovim Lua plugin
│   └── jetbrains-plugin/    # JetBrains / IntelliJ IDEA plugin
├── packages/
│   ├── core/                # Domain models, language definitions, and config
│   ├── storage/             # SQLite storage engine, migrations, and multi-repo repos
│   ├── parser/              # Tree-sitter AST parser
│   ├── indexer/             # Scanner, incremental indexing, and real-time watcher
│   ├── graph/               # Dependency graph & Cypher query engine
│   ├── analytics/           # Deep graph analytics (cycles, dead code, coupling)
│   ├── nl2cypher/           # Natural language to Cypher query translator
│   ├── retrieval/           # Multi-source ranking and search engine
│   ├── ranking/             # Multi-signal relevance scoring
│   ├── compression/         # AST skeleton extraction & progressive compressor
│   ├── context/             # Context pack builder and token budget allocator
│   ├── rules/               # AI instruction rule discovery & conflict engine
│   ├── exporters/           # Multi-agent prompt and file exporters
│   ├── git/                 # Git differential and PR context analysis
│   ├── github-action/       # GitHub Action for automated PR context
│   ├── mcp/                 # MCP protocol server implementation
│   ├── llm/                 # Multi-provider LLM connector (Local & API)
│   ├── token-counter/       # Accurate tokenizer & token estimator
│   └── shared/              # Logger, error definitions, and utilities
└── docs/                    # Architecture diagrams and specifications
```

---

## 🧪 Testing & Validation

CodeAtlas maintains a strict test suite powered by [Vitest](https://vitest.dev):

```bash
# Run full monorepo test suite
pnpm test

# Run type checks across all workspaces
pnpm typecheck

# Build all packages
pnpm build
```

---

## 📄 License

CodeAtlas is licensed under the [MIT License](LICENSE).

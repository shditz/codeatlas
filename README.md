<div align="center">
  <img src="assets/banner.jpg" alt="CodeAtlas Banner" width="100%" />
</div>

# CodeAtlas 🗺️

> **The Local-First Context Intelligence & Architecture Engine for AI Coding Agents**

CodeAtlas turns your codebase into a high-performance **Knowledge Graph** stored locally in an embedded SQLite database (`.atlas/atlas.db`). It equips AI coding assistants (such as **Google Antigravity**, **Claude Code**, **Cursor**, **Windsurf**, and **Copilot**) with structural codebase context—dramatically reducing irrelevant token usage, preventing architectural regressions, and grounding AI agent code generation in real dependency graphs.

[![CI](https://github.com/shditz/codeatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/shditz/codeatlas/actions)
[![Tests: 105 passing](<https://img.shields.io/badge/Tests-105%20passing%20(100%25)-brightgreen.svg>)](https://github.com/shditz/codeatlas)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green?logo=node.js)](https://nodejs.org/)

---

## 🚀 Why CodeAtlas?

When AI coding agents work on mid-to-large repositories, they face two core bottlenecks:

1. **Context Blindness**: LLMs lack an architectural map of which modules depend on what, leading to hallucinated imports, broken contracts, and silent regressions.
2. **Context Window Waste**: Dumping raw, entire files into an LLM context window burns token budgets and dilutes prompt attention.

**CodeAtlas solves this with deterministic local intelligence:**

- ⚡ **Local-First & 100% Private**: Everything is indexed locally into SQLite using Tree-sitter. Your code never leaves your machine.
- 🧠 **Explainable Context Packing**: Selects only task-relevant files and compresses secondary modules into AST signatures and type skeletons. Includes visual Directory Tree Packing!
- 🛡️ **Architectural Guardrails**: Automatically flags **Dead Code / Orphan Symbols**, **Circular Dependencies**, and **Cyclomatic Complexity Hotspots**.
- 🚀 **Zero-Config Setup**: `atlas init` auto-detects your language stack, package manager, and monorepo structure to generate smart ignore rules.
- 🔌 **Native Model Context Protocol (MCP)**: Plugs directly into Antigravity, Claude Desktop, Cursor, and Cline as a real-time brain extension with high-level reasoning tools (`atlas_detect_dead_code`, `atlas_complexity_report`).

---

## 🌐 Language & Parser Support Matrix

CodeAtlas uses native **Tree-sitter** grammars to extract syntax trees, exported symbols, call references, and import dependencies:

| Tier                               | Language         | File Extensions                                                         | Capabilities                                            |
| :--------------------------------- | :--------------- | :---------------------------------------------------------------------- | :------------------------------------------------------ |
| **Tier 1 (Full AST & Call Graph)** | TypeScript / TSX | `.ts`, `.tsx`, `.mts`, `.cts`                                           | AST Symbols, Call Graph, Imports, Cyclomatic Complexity |
|                                    | JavaScript / JSX | `.js`, `.jsx`, `.mjs`, `.cjs`                                           | AST Symbols, Call Graph, Imports, Cyclomatic Complexity |
|                                    | Python           | `.py`                                                                   | AST Functions/Classes, Call Graph, Module Imports       |
|                                    | Go               | `.go`                                                                   | AST Structs/Functions, Call Graph, Package Imports      |
|                                    | Rust             | `.rs`                                                                   | AST Structs/Traits/Impl, Call Graph, Crate Imports      |
|                                    | PHP              | `.php`, `.phtml`                                                        | AST Classes/Methods, Call Graph, Namespace Imports      |
| **Tier 2 (Symbol & Structure)**    | Java             | `.java`                                                                 | AST Classes, Methods, Import Graph                      |
|                                    | C#               | `.cs`                                                                   | AST Classes, Methods, Namespace Graph                   |
|                                    | C / C++          | `.c`, `.h`, `.cpp`, `.hpp`, `.cc`                                       | AST Functions, Structs, Header Includes                 |
|                                    | Ruby             | `.rb`                                                                   | AST Classes, Modules, Method Definitions                |
|                                    | Kotlin           | `.kt`, `.kts`                                                           | AST Classes, Functions, Import Graph                    |
|                                    | Swift            | `.swift`                                                                | AST Structs, Protocols, Class Definitions               |
| **Tier 3 (Content & Search)**      | Data & Markup    | `.json`, `.yaml`, `.toml`, `.md`, `.html`, `.css`, `.sql`, `Dockerfile` | FTS5 Full-Text Search (BM25 ranking), Token Counting    |

---

## 📊 Empirical Benchmarks (Verified on Real-World Repos)

CodeAtlas includes an automated **Benchmark Suite** (`pnpm run benchmark`) evaluated against real-world open-source repositories to measure context accuracy, retrieval recall, and token reduction:

### 📦 Dataset: `expressjs/express` (96 files, 71k raw tokens)

| Task Scenario                       | Target Ground Truth                                    | Retrieval Recall | Context Tokens | Token Savings   | Latency  |
| :---------------------------------- | :----------------------------------------------------- | :--------------- | :------------- | :-------------- | :------- |
| **Routing & Dispatching**           | `lib/application.js`, `lib/express.js`                 | **100%**         | 6,364          | **91%**         | 26ms     |
| **Server Bootstrap (`app.listen`)** | `lib/application.js`, `lib/express.js`                 | **50%**          | 4,555          | **94%**         | 32ms     |
| **JSON Response Serialization**     | `lib/response.js`                                      | **100%**         | 5,124          | **93%**         | 56ms     |
| **Request Cookie & Header Parsing** | `lib/request.js`                                       | **100%**         | 6,285          | **91%**         | 17ms     |
| **View Engine Template Resolution** | `lib/view.js`, `lib/application.js`, `lib/response.js` | **67%**          | 6,344          | **91%**         | 59ms     |
| **Overall Empirical Average**       | —                                                      | **83% Recall**   | —              | **92% Savings** | **38ms** |

---

## 📦 Quick Start in 3 Minutes

### 1. Install Globally

```bash
npm install -g @codeatlas-ai/cli
```

_(Or build locally from source with `pnpm install && pnpm build && pnpm --filter @codeatlas-ai/cli link --global`)_

### 2. Initialize in Your Project

Navigate to any project directory and initialize CodeAtlas:

```bash
# Auto-detects stack and creates local .atlas/ intelligence database
atlas init

# Parse AST structures, calculate complexity, and build the dependency graph
atlas index
```

### 3. Generate AI Guidelines

Auto-generate architecture rules customized for your AI assistant:

```bash
# Generate rules for Antigravity (creates AGENTS.md)
atlas rules generate antigravity

# Or generate for Claude, Cursor, Copilot, Windsurf, etc.
atlas rules generate all
```

---

## 🛠️ CLI Commands Cheat Sheet

| Command                | Category        | Description                                                                                  |
| :--------------------- | :-------------- | :------------------------------------------------------------------------------------------- |
| `atlas init`           | **Setup**       | Auto-detects project stack and initializes `.atlas/` folder, `.atlasignore`, and config.     |
| `atlas scan`           | **Setup**       | Fast scan detecting languages, frameworks, workspaces, and monorepo structure.               |
| `atlas index`          | **Core**        | Parses AST with Tree-sitter, computes complexity, and audits code health (Dead code/DAG).    |
| `atlas watch`          | **Realtime**    | Watches directory for file changes and updates the graph incrementally in real time.         |
| `atlas context`        | **AI Context**  | Extracts token-budgeted prompt packs with visual Directory Tree Packing.                     |
| `atlas export`         | **AI Context**  | Exports context packs into Markdown files for manual LLM chat sessions.                      |
| `atlas diff`           | **Quality**     | Calculates Semantic Blast Radius and severity ratings from Git diffs.                        |
| `atlas analyze`        | **Quality**     | Audits codebase for Dead Code, Circular Imports, and Git Churn Hotspots.                     |
| `atlas doctor`         | **Quality**     | Runs repository health checks and provides a readiness score.                                |
| `atlas pr`             | **Quality**     | Generates an architectural PR summary for AI Code Reviews.                                   |
| `atlas search`         | **Search**      | Semantic & Full-text search with synonym query expansion via SQLite FTS5 (BM25 ranking).     |
| `atlas query`          | **Search**      | Natural language (NL2Cypher) or Cypher graph queries.                                        |
| `atlas map`            | **Visual**      | Displays an ASCII tree map of directories and exported symbols.                              |
| `atlas rules list`     | **Rules**       | Lists all discovered AI rule files.                                                          |
| `atlas rules validate` | **Rules**       | Checks for rule conflicts and consistency.                                                   |
| `atlas rules generate` | **Rules**       | Generates guideline files for specific AI editors (`cursor`, `claude`, `antigravity`, etc.). |
| `atlas clean`          | **Maintenance** | Cleans local cache, database, and snapshots.                                                 |
| `atlas mcp`            | **Integration** | Starts the official Model Context Protocol (MCP) server over `stdio`.                        |

---

## 🤖 Model Context Protocol (MCP) Integration

Connect CodeAtlas directly to your AI Coding Assistant so it can query the codebase on-demand:

### Google Antigravity

Add to your project's `.agents/mcp_config.json` or global `~/.gemini/config/mcp_config.json`:

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

### Claude Code CLI

```bash
claude mcp add codeatlas atlas -- mcp
```

### Cursor & Claude Desktop

Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

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

---

## 🏛️ Architecture & Deep Design

For an in-depth look at CodeAtlas's monorepo layout, C4 container relationships, SQLite schema, and AST data pipelines, see [**ARCHITECTURE.md**](ARCHITECTURE.md).

---

## ⚙️ Configuration (`.atlas/config.toml`)

CodeAtlas configuration is stored in `.atlas/config.toml` in clean TOML format:

```toml
[project]
name = "MyAwesomeProject"

[index]
follow_symlinks = false
include_tests = true
max_file_size = 1048576

[context]
max_tokens = 12000
default_mode = "full" # "full", "signature", "summary", or "digest"

[security]
scan_secrets = true
exclude_patterns = [".env", "*.pem", "*.key"]
```

---

## 📖 Web Documentation

To run the interactive documentation portal locally:

```bash
pnpm run docs:dev
```

Then visit [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📄 License

MIT © 2026-present CodeAtlas Contributors.

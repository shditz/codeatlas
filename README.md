<div align="center">
  <img src="assets/banner.jpg" alt="CodeAtlas Banner" width="100%" />
</div>

# CodeAtlas

> **Give AI a map of your codebase.**  
> Local-first context engine, AST indexer, interactive dependency graph, and universal AI rules exporter for modern software engineering.

[![CI](https://github.com/shditz/codeatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/shditz/codeatlas/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.0.0-green?logo=node.js)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-73%2F73%20Passed-success?logo=vitest)](https://vitest.dev)
[![Documentation](https://img.shields.io/badge/Docs-VitePress-black)](https://github.com/shditz/codeatlas)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local-success)](https://github.com/shditz/codeatlas)

---

## Table of Contents

- [Overview](#overview)
- [Why CodeAtlas?](#why-codeatlas)
- [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [Installation](#installation)
- [Quick Start Guide](#quick-start-guide)
- [CLI Reference](#cli-reference)
- [VS Code Extension Guide](#vs-code-extension-guide)
- [Web Documentation Site](#web-documentation-site)
- [Model Context Protocol (MCP) Setup](#model-context-protocol-mcp-setup)
- [Configuration](#configuration)
- [Monorepo Structure](#monorepo-structure)
- [Development & Testing](#development--testing)
- [License](#license)

---

## Overview

**CodeAtlas** is a local-first developer platform that bridges the gap between massive software codebases and AI coding assistants (such as Cursor, Claude, Windsurf, Devin, Roo Code, Copilot, Antigravity, and Aider).

Rather than dumping raw, unorganized file trees into language model prompts—which wastes tokens and leads to hallucinated dependencies—CodeAtlas parses source code into Abstract Syntax Trees (AST), constructs a relational dependency graph in an embedded SQLite database (`.atlas/codeatlas.db`), and delivers token-optimized context packs, prompt rule synchronizers, and spatial 2D/3D architecture maps.

CodeAtlas operates **100% offline**, ensuring your code never leaves your local workstation.

---

## Why CodeAtlas?

| Challenge with AI Coding                                                                                     | How CodeAtlas Solves It                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Context Window Waste**: Feeding entire source files exhausts token budgets rapidly.                        | **Progressive Compression**: Automatically downgrades deep dependencies from full source to signatures and digests (`full` -> `signature` -> `digest`). |
| **Hallucinated Dependencies**: LLMs cannot trace cross-module imports across large projects.                 | **AST Graph Engine**: Builds verified import and containment edges using native Tree-sitter parsers.                                                    |
| **Inconsistent Prompt Rules**: Maintaining `.cursorrules`, `CLAUDE.md`, and `AGENTS.md` manually is tedious. | **Universal Rules Exporter**: Automatically generates and synchronizes customized rule files for all AI tools from actual project metadata.             |
| **Opaque Architecture**: Complex directory trees are difficult to understand at a glance.                    | **Interactive 2D/3D Graph**: Real-time WebGL/Canvas visualizer in VS Code with spotlight path isolation.                                                |
| **Privacy & Security Risks**: Cloud-based indexers upload source code to external servers.                   | **100% Local-First**: Runs entirely on your machine via embedded SQLite and local Tree-sitter bindings.                                                 |

---

## System Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       INGESTION & PARSING                                        │
│  TypeScript / JavaScript / Python / PHP / Go / Rust / HTML / CSS  ──> [ Tree-sitter AST Parser ] │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    LOCAL STORAGE & REPOSITORIES                                  │
│                 SQLite Database (.atlas/codeatlas.db) + FTS5 Lexical Search Index                │
│             [ Files ] ── [ Symbols & Signatures ] ── [ Dependency Edges ] ── [ Hashes ]          │
└───────────────────────┬────────────────────────┼─────────────────────────┬───────────────────────┘
                        │                        │                         │
                        ▼                        ▼                         ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌────────────────────────────────┐
│      CONTEXT & RETRIEVAL     │ │      RULES & COMPLIANCE      │ │      SPATIAL VISUALIZATION     │
│ - BM25 Multi-Signal Search   │ │ - Cursor (.cursorrules)      │ │ - 3D Force-Directed WebGL Map  │
│ - 1-Hop / 2-Hop Graph Spread │ │ - Claude (CLAUDE.md)         │ │ - 2D Planar Canvas View        │
│ - Progressive Token Packager │ │ - Windsurf (.windsurfrules)  │ │ - Spotlight Path Isolation     │
│ - MCP Server (JSON-RPC)      │ │ - Devin, Roo Code, Aider     │ │ - VS Code Bi-Directional Jump  │
└──────────────────────────────┘ └──────────────────────────────┘ └────────────────────────────────┘
```

---

## Key Features

### 1. Multi-Language AST Parsing & Incremental Indexing

- Native Tree-sitter parsers for **TypeScript, JavaScript, Python, PHP, Go, Rust, HTML, and CSS**.
- Extracts top-level declarations, function signatures, class methods, interface definitions, types, enums, imports, and exports.
- Computes SHA-256 content hashes to index only modified files on subsequent runs, completing incremental updates in milliseconds.

### 2. Smart Multi-Signal Retrieval & Progressive Compression

- **SQLite FTS5 Full-Text Search**: Sub-millisecond BM25 keyword retrieval across all project files.
- **Architectural Centrality Scoring**: Prioritizes foundational modules with high inbound import counts.
- **Dynamic Token Budgeting**: Automatically fits project context into strict budgets (e.g. 4k, 8k, 16k, 32k tokens) by replacing full implementations with type signatures for secondary dependencies.

### 3. Universal AI Rules Exporter

Generate synchronized prompt rules and architectural guidelines from actual codebase state:

| Target Platform        | Exported File     | Description                                                   |
| ---------------------- | ----------------- | ------------------------------------------------------------- |
| **Cursor**             | `.cursorrules`    | System prompt and file navigation guidelines for Cursor AI.   |
| **Anthropic Claude**   | `CLAUDE.md`       | Context summary and commands for Claude Desktop & Claude CLI. |
| **Codeium Windsurf**   | `.windsurfrules`  | Workspace rules for the Windsurf Cascade engine.              |
| **Cognition Devin**    | `DEVIN.md`        | Machine-readable codebase layout for Devin autonomous agent.  |
| **Roo Code**           | `.roorules`       | Mode rules and execution standards for Roo Code in VS Code.   |
| **Aider**              | `.aider.atlas.md` | Architecture roadmap for Aider terminal pair programming.     |
| **Agents / SWE-agent** | `AGENTS.md`       | Standard instructions for Antigravity, OpenHands, SWE-agent.  |

### 4. Interactive 2D & 3D Architecture Visualizer

- **3D Spatial Layout**: WebGL force-directed layout rendering directories as orbital nodes and files as interactive spheres.
- **2D Planar Mode**: Canvas rendering with zoom-activated label pills and collision-free D3 repulsion physics.
- **Spotlight Mode**: Highlights active dependency chains on hover/click while dimming unrelated modules.
- **Bi-Directional Editor Bridge**: Click "Open in Editor" in the inspector drawer to focus the file in VS Code.

### 5. Architectural Analytics (`atlas analyze`)

- **Circular Dependency Detection**: Identifies circular import loops across packages.
- **Dead Code Detection**: Finds unreferenced source files and orphan modules with 0 incoming dependencies.
- **Coupling & Instability Metrics**: Computes Fan-in, Fan-out, and Instability index ($I = \frac{Ce}{Ca + Ce}$).

### 6. Natural Language Query Engine (`atlas query`)

- Translate plain English and natural language requests into Cypher graph queries:
  ```bash
  atlas query "who calls handleLogin"
  atlas query "which files import parser"
  atlas query "show all typescript files with high centrality"
  ```

---

## Installation

### Prerequisites

- **Node.js**: `>= 20.0.0` (Node.js 22 LTS recommended)
- **pnpm**: `>= 9.0.0` (or npm / yarn)
- **Git**

### Global Installation (CLI)

```bash
# Install globally using pnpm
pnpm add -g @codeatlas/cli

# Or using npm
npm install -g @codeatlas/cli
```

### Local Monorepo Setup

```bash
# 1. Clone repository
git clone https://github.com/shditz/codeatlas.git
cd codeatlas

# 2. Install workspace dependencies
pnpm install

# 3. Build all packages and applications
pnpm build

# 4. Verify test suite (73/73 tests passing)
pnpm test
```

---

## Quick Start Guide

### 1. Initialize & Index Current Repository

Navigate to any software project directory and run:

```bash
# Initialize configuration (creates codeatlas.config.json)
atlas init

# Parse AST and index into .atlas/codeatlas.db
atlas index
```

### 2. Export Rules for All AI Assistants

```bash
# Generate .cursorrules, CLAUDE.md, .windsurfrules, etc.
atlas rules --all
```

### 3. Generate a Token-Budgeted Context Pack

```bash
# Build context pack for a specific task within an 8,000 token budget
atlas context "implement oauth authentication" --tokens 8000
```

### 4. Run Architectural Analytics

```bash
atlas analyze
```

---

## CLI Reference

The `atlas` CLI includes a comprehensive suite of developer commands:

| Command                 | Description                                            | Example                                |
| ----------------------- | ------------------------------------------------------ | -------------------------------------- |
| `atlas init`            | Initialize a new CodeAtlas configuration file          | `atlas init`                           |
| `atlas scan`            | Quickly scan workspace files without full AST parsing  | `atlas scan`                           |
| `atlas index`           | Parse AST and update `.atlas/codeatlas.db`             | `atlas index --force`                  |
| `atlas watch`           | Start real-time file watcher with incremental indexing | `atlas watch`                          |
| `atlas map`             | Display ASCII structural tree of the repository        | `atlas map --depth 3`                  |
| `atlas search <query>`  | Search symbols and files using FTS5 lexical ranking    | `atlas search "UserRepository"`        |
| `atlas context <query>` | Generate token-budgeted prompt context pack            | `atlas context "payment flow" -t 4000` |
| `atlas rules`           | Export AI rule files (`--target` or `--all`)           | `atlas rules --all`                    |
| `atlas analyze`         | Run circular dependency and dead code analysis         | `atlas analyze`                        |
| `atlas query <query>`   | Execute Cypher or Natural Language graph query         | `atlas query "who imports storage"`    |
| `atlas mcp`             | Launch Model Context Protocol stdio server             | `atlas mcp`                            |
| `atlas graph`           | Launch standalone browser architecture graph           | `atlas graph --port 4200`              |
| `atlas diff`            | Compare AST symbol diffs between Git branches          | `atlas diff main..feat/auth`           |
| `atlas doctor`          | Verify local database integrity and parser health      | `atlas doctor`                         |
| `atlas clean`           | Remove `.atlas/` cache and SQLite database             | `atlas clean --force`                  |

---

## VS Code Extension Guide

The official **CodeAtlas VS Code Extension** integrates AST indexing and interactive 2D/3D architecture graph visualization directly into your editor.

### Installing from Source / VSIX

1. Build the extension package:
   ```bash
   pnpm --filter codeatlas-vscode build
   ```
2. In VS Code, open Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`), click `...` -> **Install from VSIX...**, and select `apps/vscode-extension/codeatlas-vscode-0.1.0.vsix`.

### Running & Debugging in VS Code

1. Open the `CodeAtlas` root folder in Visual Studio Code.
2. Open the **Run and Debug** view (`Ctrl+Shift+D` / `Cmd+Shift+D`).
3. Select **"Extension"** from the dropdown and press **`F5`**.
4. An **[Extension Development Host]** window will open with CodeAtlas running live.

### Extension Commands & Shortcuts

- Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):
  - **`CodeAtlas: Open Interactive Graph`**: Opens the 2D/3D architecture map tab.
  - **`CodeAtlas: Index Workspace`**: Triggers full AST re-indexing.
  - **`CodeAtlas: Export AI Rules`**: Generates rules for Cursor, Claude, etc.
  - **`CodeAtlas: Show Context Budget`**: Displays symbol metrics and token usage.
- **Editor Title Bar Button**: Click the graph icon in the top-right corner of any open code file to inspect its dependency relationships immediately.

---

## Web Documentation Site

CodeAtlas comes with a complete, modern documentation portal powered by **VitePress**.

### Running Documentation Locally

```bash
# Start VitePress documentation development server
pnpm run docs:dev
```

Open [http://localhost:5173/](http://localhost:5173/) in your browser to view the interactive documentation.

### Building Static Documentation Bundle

```bash
# Compile production static site (output: apps/docs/.vitepress/dist)
pnpm run docs:build

# Preview the built documentation locally
pnpm run docs:preview
```

---

## Model Context Protocol (MCP) Setup

CodeAtlas implements a native Model Context Protocol (MCP) server over standard input/output (`stdio`). This allows AI assistants like **Claude Desktop**, **Cursor**, or **Antigravity** to query your codebase in real time.

### Claude Desktop Integration

Add CodeAtlas to your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "codeatlas": {
      "command": "node",
      "args": ["/absolute/path/to/CodeAtlas/apps/cli/dist/index.js", "mcp"],
      "env": {
        "CODEATLAS_WORKSPACE": "/path/to/your/project"
      }
    }
  }
}
```

### Supported MCP Tools

- `get_repo_map`: Returns structural repository tree and module boundaries.
- `find_symbol`: Looks up definitions, signatures, and line numbers for any symbol.
- `get_dependencies`: Returns incoming and outgoing import edges for a given file.
- `get_context_pack`: Assembles token-optimized context packs for specific coding queries.

---

## Configuration

CodeAtlas can be configured globally or per-project via `codeatlas.config.json`:

```json
{
  "include": ["src/**/*", "packages/**/*", "apps/**/*"],
  "exclude": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**",
    "**/vendor/**",
    "**/coverage/**"
  ],
  "maxFileSizeKB": 2048,
  "rules": {
    "autoExportOnIndex": true,
    "defaultTargets": ["cursor", "claude", "windsurf", "devin", "roocode", "agents"]
  },
  "context": {
    "defaultTokenBudget": 8000,
    "strategy": "progressive"
  }
}
```

---

## Monorepo Structure

```text
CodeAtlas/
├── packages/
│   ├── core/              # Domain models, entities, and shared TypeScript interfaces
│   ├── parser/            # Multi-language Tree-sitter AST extraction pipeline
│   ├── storage/           # SQLite database abstraction, migrations, and repositories
│   ├── graph/             # Directed multi-graph algorithms and topological sorters
│   ├── rules/             # AI prompt rule generator and template engine
│   ├── compression/       # Context token budgeting and semantic symbol digest
│   ├── retrieval/         # BM25 lexical ranking and multi-signal search engine
│   ├── analytics/         # Circular dependency, dead code, and coupling analyzers
│   ├── nl2cypher/         # Natural language to Cypher query translator
│   ├── mcp/               # Model Context Protocol (MCP) server implementation
│   ├── git/               # Local Git history, branch diffing, and file status
│   ├── token-counter/     # Fast BPE / cl100k token estimation
│   ├── llm/               # Local/remote LLM provider client abstraction
│   ├── ranking/           # Graph centrality and PageRank scoring
│   ├── github-action/     # CI GitHub Action integration
│   └── shared/            # Shared logging, error types, and utilities
└── apps/
    ├── cli/               # Standalone binary executable (`atlas`)
    ├── vscode-extension/  # Official Visual Studio Code extension
    ├── webview/           # React 2D/3D force-directed graph web application
    └── docs/              # VitePress documentation portal
```

---

## Development & Testing

### Running Tests

We maintain **100% test pass rate** using Vitest:

```bash
# Run all unit test suites
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage
```

### Code Quality & Validation

```bash
# Typecheck all 27 monorepo projects
pnpm typecheck

# Run ESLint across workspace
pnpm lint

# Check code formatting with Prettier
pnpm format:check

# Auto-format all files
pnpm format
```

---

## Contributing

Contributions are welcome! Please review [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming conventions, Conventional Commits formatting, and PR submission guidelines.

---

## Security & Privacy

CodeAtlas follows strict local-first privacy principles:

- No source code or telemetry is transmitted over the network.
- Sensitive credentials and keys are automatically masked from context packs.
- See [SECURITY.md](SECURITY.md) for vulnerability disclosure details.

---

## License

CodeAtlas is open-source software licensed under the [MIT License](LICENSE).  
Copyright (c) 2026-present CodeAtlas Contributors.

<div align="center">
  <img src="assets/banner.jpg" alt="CodeAtlas Banner" width="100%" />
</div>

# CodeAtlas

> Local-first codebase indexer, architecture graph visualizer, and context engine for AI coding assistants.

[![CI](https://github.com/shditz/codeatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/shditz/codeatlas/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.0.0-green?logo=node.js)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-73%2F73%20Passed-success?logo=vitest)](https://vitest.dev)
[![Documentation](https://img.shields.io/badge/Docs-VitePress-black)](https://github.com/shditz/codeatlas)

---

## Overview

**CodeAtlas** is an offline toolchain that analyzes software repositories and provides structured architectural context to AI coding assistants (such as Cursor, Claude, Windsurf, Devin, and Roo Code).

Instead of feeding raw, unorganized file dumps into language models, CodeAtlas parses your project's syntax tree (AST), extracts symbols and import relationships, stores them in a local SQLite database, and generates targeted context packs within strict token budgets.

It also includes a built-in 2D/3D dependency graph visualizer and a Model Context Protocol (MCP) server.

---

## Architecture & Data Flow

```text
Source Files ──> [ Tree-sitter Parser ] ──> [ SQLite Storage (.atlas/codeatlas.db) ]
                                                        │
         ┌──────────────────────────────────────────────┼──────────────────────────────┐
         ▼                                              ▼                              ▼
[ Context Compressor ]                       [ AI Rules Exporter ]            [ Graph Visualizer ]
Token-budgeted prompt packs                  .cursorrules, CLAUDE.md, etc.    2D / 3D Webview in VS Code
```

1. **AST Parsing**: Discovers source files and extracts functions, classes, interfaces, imports, and exports using Tree-sitter.
2. **Local Caching**: Stores parsed metadata, symbol line ranges, content hashes, and dependency edges in an embedded SQLite database (`.atlas/codeatlas.db`).
3. **Context Packing**: Assembles relevant file subsets and structural signature digests within user-defined token budgets using BM25 relevance scoring.
4. **Rules Generation**: Automatically creates and synchronizes prompt rule files for various AI tools.
5. **Graph Visualization**: Renders an interactive force-directed graph of file and folder dependencies directly in VS Code.
6. **MCP Server**: Exposes repository structure and symbol lookup tools via the standard Model Context Protocol.

---

## Features

### 1. Multi-Language AST Parsing

- Parses Abstract Syntax Trees using Tree-sitter grammars.
- Supported languages: **TypeScript, JavaScript, Python, PHP, Go, Rust, HTML, and CSS**.
- Extracts top-level declarations, method signatures, parameter types, and normalized module imports.
- Incremental indexing based on SHA-256 file hashes to skip unchanged files.

### 2. Universal AI Rules Exporter

Generates customized rule and context configuration files derived from actual project structure, linting rules, and dependency constraints:

| Target     | Output File       | Compatible Assistant              |
| ---------- | ----------------- | --------------------------------- |
| `cursor`   | `.cursorrules`    | Cursor AI Editor                  |
| `windsurf` | `.windsurfrules`  | Codeium Windsurf                  |
| `claude`   | `CLAUDE.md`       | Anthropic Claude Desktop & CLI    |
| `devin`    | `DEVIN.md`        | Cognition Devin                   |
| `roocode`  | `.roorules`       | Roo Code (VS Code Extension)      |
| `aider`    | `.aider.atlas.md` | Aider Pair Programmer             |
| `agents`   | `AGENTS.md`       | OpenHands, Antigravity, SWE-agent |

### 3. Interactive Architecture Graph (VS Code & Browser)

- 2D and 3D force-directed graph view of workspace directories, files, and import links.
- Real-time search filter for locating files and symbols.
- Spotlight mode: highlights connected dependency paths on hover/click while dimming unrelated nodes.
- Inspector drawer displaying file size, language, and a direct "Open in Editor" shortcut.

### 4. Context Compression & Token Budgeting

- Replaces internal function/method implementations with interface signatures to fit large codebases into limited prompt windows.
- BM25 lexical ranking combined with dependency graph distance to prioritize relevant files for specific coding tasks.

### 5. Model Context Protocol (MCP) Server

- Standard JSON-RPC server implementing MCP tools: `get_repo_map`, `find_symbol`, `get_dependencies`, and `get_context_pack`.
- Compatible with Claude Desktop, Cursor, and any MCP client.

### 6. Local-First & Privacy Guaranteed

- 100% offline execution. No source code or telemetry is transmitted over the network.
- Respects `.gitignore` and custom `.atlasignore` rules.

---

## Installation

### CLI Installation

```bash
# Global installation via npm
npm install -g @codeatlas/cli

# Or via pnpm
pnpm add -g @codeatlas/cli
```

### VS Code Extension

Download the `.vsix` file from the [Releases](https://github.com/shditz/codeatlas/releases) page and install it via `Extensions -> Install from VSIX...`.

---

## CLI Usage

```bash
# Index current repository into .atlas/codeatlas.db
atlas index

# Force re-indexing of all files
atlas index --force

# Export AI rule files for all supported platforms
atlas rules --all

# Export rules for a specific platform
atlas rules --target cursor
atlas rules --target claude

# Launch standalone graph visualizer
atlas graph --port 4200

# Search symbols in the database
atlas query "AuthService"
```

---

## Configuration (`codeatlas.config.json`)

```json
{
  "include": ["src/**/*", "packages/**/*", "apps/**/*"],
  "exclude": ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/vendor/**"],
  "maxFileSizeKB": 2048,
  "rules": {
    "autoExportOnIndex": true,
    "defaultTargets": ["cursor", "claude", "windsurf", "devin"]
  }
}
```

---

## Monorepo Structure

```
CodeAtlas/
├── packages/
│   ├── core/           Domain models and shared TypeScript interfaces
│   ├── parser/         Tree-sitter AST extraction pipeline
│   ├── storage/        SQLite repository layer and schema migrations
│   ├── graph/          In-memory dependency graph and algorithms
│   ├── rules/          AI rule generator and template engine
│   ├── compression/    Context token budgeting and symbol summarizer
│   ├── retrieval/      BM25 search and ranking engine
│   └── mcp/            Model Context Protocol server
└── apps/
    ├── cli/            Command-line application (`atlas`)
    ├── vscode-extension/ Official VS Code extension
    ├── webview/        React 2D/3D graph web application
    └── docs/           VitePress documentation site
```

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run unit tests
pnpm test
```

---

## License

MIT License. Copyright (c) 2026-present CodeAtlas Contributors.

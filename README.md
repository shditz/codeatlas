<div align="center">
  <img src="assets/banner.jpg" alt="CodeAtlas Banner" width="100%" />
</div>

# CodeAtlas

CodeAtlas is a local-first platform that indexes your codebase into a dependency graph using an embedded SQLite database. It provides clear architectural visualization and accurate, token-optimized context for coding tools.

[![CI](https://github.com/shditz/codeatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/shditz/codeatlas/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.0.0-green?logo=node.js)](https://nodejs.org/)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Installation](#installation)
- [Usage Guide](#usage-guide)
  - [CLI Commands](#cli-commands)
  - [VS Code Extension](#vs-code-extension)
  - [Web Documentation Site](#web-documentation-site)
- [Model Context Protocol (MCP) Setup](#model-context-protocol-mcp-setup)
- [Configuration](#configuration)
- [Monorepo Structure](#monorepo-structure)
- [Development & Testing](#development--testing)
- [License](#license)

---

## Overview

CodeAtlas maps out your codebase by parsing source code into Abstract Syntax Trees (AST) using Tree-sitter. It stores relationships (such as function calls, module imports, and classes) in a local `.atlas/atlas.db` SQLite database. This creates a detailed map of your code that can be used to visualize architecture or generate accurate context packs for other tools.

Because it runs completely offline, your code remains 100% private.

## Key Features

- **Multi-Language AST Parsing**: Supports TypeScript, JavaScript, Python, PHP, Go, Rust, HTML, and CSS natively.
- **Local-First SQLite Storage**: Fast retrieval of files, symbols, and dependencies without relying on external cloud indexing.
- **Rule File Synchronization**: Automatically generates and syncs project-specific rule files (like `.cursorrules`, `CLAUDE.md`, `.windsurfrules`).
- **Interactive Visualizer**: 2D and 3D architectural node graph for codebase exploration.
- **Context Generation**: Extracts token-budgeted prompt packs for development tasks.
- **Model Context Protocol (MCP)**: Implements native MCP server over `stdio` for real-time integration with desktop tools.

---

## Installation

### Prerequisites

- **Node.js**: `>= 20.0.0` (Node.js 22 LTS recommended for `node:sqlite` features)
- **pnpm**: `>= 9.0.0`
- **Git**

### Building and Installing from Source

CodeAtlas is a monorepo. It is not currently published to the public NPM registry. To install it, you must build it locally from source:

```bash
# 1. Clone the repository
git clone https://github.com/shditz/codeatlas.git
cd codeatlas

# 2. Install workspace dependencies
pnpm install

# 3. Build all packages and applications
pnpm build

# 4. Link the CLI globally so it can be used anywhere
pnpm --filter @codeatlas/cli link --global
```

You can now use the `atlas` command globally in your terminal.

---

## Usage Guide

### CLI Commands

The `atlas` CLI offers a wide range of commands to manage and explore your codebase:

```bash
# Initialize configuration (creates codeatlas.config.json)
atlas init

# Parse the codebase and build the local SQLite index
atlas index

# Start a real-time file watcher to update the index incrementally
atlas watch

# Search for symbols or files using keyword search
atlas search "UserRepository"

# Generate rules for various environments (.cursorrules, CLAUDE.md, etc.)
atlas rules --all

# Run circular dependency and codebase analytics
atlas analyze

# Generate a context pack within an 8,000 token limit
atlas context "implement oauth authentication" --tokens 8000

# Run a Cypher or natural language query against the codebase graph
atlas query "who imports storage"
```

### VS Code Extension

CodeAtlas provides a native VS Code extension for inline AST indexing and visual graph exploration.

**Installation (VSIX):**

1. Build the extension package:
   ```bash
   pnpm --filter codeatlas-vscode build
   ```
2. In VS Code, go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Click the `...` menu -> **Install from VSIX...**
4. Select the built file: `apps/vscode-extension/codeatlas-vscode-0.1.0.vsix`.

**Using the Extension:**

- Run `CodeAtlas: Index Workspace` from the Command Palette to build the initial index.
- Run `CodeAtlas: Open Interactive Graph` to open the visual architecture map tab.
- Click the graph icon in the editor title bar of any open file to see its direct relationships.

### Web Documentation Site

The repository includes a detailed VitePress documentation portal.

**Running the Web Documentation Locally:**

```bash
# Start the documentation development server
pnpm run docs:dev
```

Open [http://localhost:5173/](http://localhost:5173/) in your browser.

**Building the Static Site:**

```bash
# Build the static site output to apps/docs/.vitepress/dist
pnpm run docs:build
```

---

## Model Context Protocol (MCP) Setup

CodeAtlas includes a Model Context Protocol (MCP) server that operates over standard input/output (`stdio`).

### Integrating with Claude Desktop

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

---

## Configuration

CodeAtlas relies on a `codeatlas.config.json` file placed in the root of your project:

```json
{
  "include": ["src/**/*", "packages/**/*", "apps/**/*"],
  "exclude": ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"],
  "maxFileSizeKB": 2048,
  "rules": {
    "autoExportOnIndex": true,
    "defaultTargets": ["cursor", "claude", "agents"]
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
│   ├── core/              # Domain models and shared interfaces
│   ├── parser/            # Multi-language Tree-sitter pipeline
│   ├── storage/           # SQLite abstraction and repositories
│   ├── graph/             # Graph algorithms and queries
│   ├── rules/             # Rule generator for integrations
│   ├── mcp/               # Model Context Protocol server
│   └── shared/            # Shared utilities and logging
└── apps/
    ├── cli/               # Command Line Interface (atlas)
    ├── vscode-extension/  # Visual Studio Code extension
    ├── webview/           # 2D/3D force-directed React web app
    └── docs/              # VitePress documentation portal
```

---

## Development & Testing

Ensure you run these commands from the root of the repository:

```bash
# Run all unit tests
pnpm test

# Typecheck all packages
pnpm typecheck

# Run linter
pnpm lint

# Format code
pnpm format
```

---

## License

CodeAtlas is an open-source project licensed under the [MIT License](LICENSE).

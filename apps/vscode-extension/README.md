# 🗺️ CodeAtlas — AI Context Intelligence for VS Code

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/shditz/codeatlas)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/shditz/codeatlas/blob/main/LICENSE)
[![Platform](https://img.shields.io/badge/Platform-VS%20Code%20%7C%20Antigravity%20%7C%20Cursor%20%7C%20Windsurf-purple.svg)](https://github.com/shditz/codeatlas)

> **Give AI a GPS Map of Your Codebase.**
> CodeAtlas is the local-first architectural intelligence engine for developers and AI coding assistants (Google Antigravity, Claude Code, Cursor, Windsurf, Devin, and Copilot).

---

## ✨ Features at a Glance

- 🌐 **Interactive 2D / 3D Architecture Graph Canvas**: Explore full-codebase dependencies with real-time WebGL force-directed graphs and Spotlight tracing.
- 🌳 **Codebase Architecture & Map Sidebar**: Instant AST symbol explorer (Classes, Functions, Interfaces, Cyclomatic Complexity).
- 📜 **AI Agent Rules Governance**: Real-time discovery, conflict validation, and unified synchronization for `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, and more.
- 📦 **Token-Budgeted Context Export**: Right-click any file to generate secret-redacted, compressed AST signatures (saving up to 92% LLM tokens).
- ⚡ **Model Context Protocol (MCP) Integration**: Connects with 16 native tools for real-time autonomous agent querying.
- 🔒 **100% Local-First & Zero Telemetry**: Embedded SQLite (`.atlas/atlas.db`) powered by Node 22 native SQLite with automatic secret sanitization.

---

## 🚀 Quick Start

### 1. Index Your Workspace

Open any project folder in VS Code / Antigravity / Cursor, open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS) and run:

```
CodeAtlas: Index / Refresh Codebase
```

CodeAtlas will scan your directory, extract AST symbols via Tree-sitter, link module dependencies, and build a local SQLite graph in `.atlas/atlas.db`.

### 2. Open the Interactive 3D/2D Graph View

- Click the **CodeAtlas (Map)** icon in the left Activity Bar.
- Or click the **Graph View** button at the top-right of any open editor tab.
- Or run `CodeAtlas: Open Interactive Graph View` from the Command Palette.

### 3. Connect to Your AI Assistant (1-Click MCP Setup)

Open your integrated terminal and run:

```bash
atlas mcp setup
```

This automatically configures Google Antigravity, Cursor, Claude Desktop, Windsurf, Roo Code, Trae, Zed, and Continue to query CodeAtlas on demand!

---

## ⌨️ Commands & Shortcuts

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type `CodeAtlas`:

| Command                                  | Description                                                                  |
| :--------------------------------------- | :--------------------------------------------------------------------------- |
| `CodeAtlas: Open Interactive Graph View` | Opens the 3D/2D force-directed dependency graph tab                          |
| `CodeAtlas: Index / Refresh Codebase`    | Re-indexes AST symbols, dependencies, and git churn                          |
| `CodeAtlas: Export Context for AI Agent` | Generates a compressed context pack for the active file or task              |
| `CodeAtlas: Generate Git PR Context`     | Creates a comprehensive architectural blast-radius summary for Pull Requests |
| `CodeAtlas: Run Cypher Graph Query`      | Executes graph queries across codebase dependencies                          |
| `CodeAtlas: Toggle Real-time Watcher`    | Enables/disables live background indexing on file save (`Ctrl+S`)            |

---

## 🖱️ Context Menu Integration

- **File Explorer**: Right-click any file or folder ➔ **CodeAtlas: Export Context for AI Agent**.
- **Editor Tab**: Right-click in the active editor ➔ **CodeAtlas: Export Context for AI Agent**.
- **Editor Title Bar**: Click the **Graph** icon to view the dependency radius of the active file.

---

## ⚙️ Extension Settings

| Setting                           | Default | Description                                                          |
| :-------------------------------- | :------ | :------------------------------------------------------------------- |
| `codeatlas.autoIndexOnSave`       | `true`  | Automatically update AST symbols incrementally when files are saved. |
| `codeatlas.defaultGraphDimension` | `"3D"`  | Default graph layout dimension (`"3D"` WebGL or `"2D"` Canvas).      |
| `codeatlas.maxContextTokens`      | `12000` | Token budget limit for generated AI context packs.                   |

---

## 🔒 Security & Privacy

CodeAtlas operates **strictly offline and on-device**:

- All databases and indexes are stored in `.atlas/atlas.db` inside your workspace.
- Built-in `SecretScanner` automatically redacts API keys, cloud tokens, private keys, and passwords before exporting context or serving MCP queries.
- **Zero cloud telemetry, zero remote tracking.**

---

## 📄 License & Links

- **Repository**: [https://github.com/shditz/codeatlas](https://github.com/shditz/codeatlas)
- **Documentation**: [https://github.com/shditz/codeatlas/tree/main/apps/docs](https://github.com/shditz/codeatlas/tree/main/apps/docs)
- **License**: MIT

# CodeAtlas for VS Code & Cursor

> Local dependency graphs and context intelligence for AI coding assistants.

CodeAtlas is the official extension for **Visual Studio Code**, **Google Antigravity**, **Cursor**, and **Windsurf**. It integrates a 2D/3D WebGL architecture canvas, live blast radius telemetry, CodeLens graph navigation, and real-time AI linter diagnostics directly into your editor.

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/shditz.codeatlas-official?logo=visual-studio-code&label=VS%20Code%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=shditz.codeatlas-official)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/shditz/codeatlas)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/shditz/codeatlas/blob/main/LICENSE)

---

## ⚡ Installation

### 1. Visual Studio Marketplace (Recommended)

- **Extensions View:** Search for [**`CodeAtlas`** (`shditz.codeatlas-official`)](https://marketplace.visualstudio.com/items?itemName=shditz.codeatlas-official) in the Extensions tab (`Ctrl+Shift+X` / `Cmd+Shift+X`) and click **Install**.
- **Terminal:**
  ```bash
  code --install-extension shditz.codeatlas-official
  ```
  _(For Cursor: `cursor --install-extension shditz.codeatlas-official`)_

### 2. Manual VSIX Install (Offline / Air-Gapped)

1. Download `codeatlas-official-2.0.0.vsix` from [GitHub Releases](https://github.com/shditz/codeatlas/releases).
2. In VS Code or Cursor, open the Extensions view (`Ctrl+Shift+X`).
3. Click the **`...`** menu in the top-right corner and choose **"Install from VSIX..."**.
4. Select the downloaded `.vsix` file.

---

## Key Features

- **Interactive 2D / 3D Architecture Canvas:** Explore full-repository dependency graphs powered by Three.js WebGL rendering with 7 specialized heatmap coloring modes (`Language`, `Cluster`, `Git Churn`, `Instability`, `Blast Radius`, `Debt Hotspots`, `Lines of Code`).
- **CodeLens "Explain with Graph":** Click the `⚡ Explain with Graph` CodeLens above functions, classes, and interfaces to focus the 3D canvas directly on local dependencies.
- **Live Blast Radius Monitor:** Status Bar indicator (`$(flame) Blast: X files`) displaying direct and cascading callers in real time with 1-click prompt export for AI assistants.
- **Automated AI Rules Synchronization:** Keep `.cursor/rules/`, `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md` synchronized with live DAG architecture blueprints.
- **AI Linter Guard & QuickFix:** Real-time diagnostics for circular import cycles and Domain-Driven Design (DDD) layer regressions with 1-click refactoring actions (`Ctrl+.`).
- **Multi-Repo & Microservices Mesh:** Aggregates monorepo subpackages and polyrepos into a unified service mesh with automated HTTP endpoint-to-client discovery.
- **Architecture Sidebar Explorer:** Browse AST symbols, calculate cyclomatic complexity, and inspect project health from the activity bar.
- **Local-First Privacy:** All indexing and graph computations run locally in SQLite (`.atlas/atlas.db`) with automatic in-memory secret redaction.

---

## Quickstart

1. Open any project workspace in your editor.
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:
   ```
   CodeAtlas: Index / Refresh Codebase
   ```
3. Click the **CodeAtlas** icon in the Activity Bar or run:
   ```
   CodeAtlas: Open Interactive Graph View
   ```
4. Connect your AI coding assistants by running:
   ```bash
   atlas mcp setup --all
   ```

---

## Commands Reference

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type `CodeAtlas`:

| Command                                                   | Description                                                            |
| :-------------------------------------------------------- | :--------------------------------------------------------------------- |
| `CodeAtlas: Open Interactive Graph View`                  | Opens the 2D/3D force-directed dependency graph tab                    |
| `CodeAtlas: Index / Refresh Codebase`                     | Re-indexes AST symbols, dependencies, and git churn                    |
| `CodeAtlas: Analyze Blast Radius Impact`                  | Analyzes active file impact with 1-click prompt export for AI          |
| `CodeAtlas: Sync AI Rules & Architecture Map`             | Updates live DAG architecture blueprint in AI rule files               |
| `CodeAtlas: Open Multi-Repo & Microservices Map`          | Aggregates monorepos or polyrepos into a global architecture network   |
| `CodeAtlas: Export Architecture Schema (.codeatlas.json)` | Exports service schema for multi-repo sharing and service mesh mapping |
| `CodeAtlas: Export Context for AI Agent`                  | Generates a compressed context pack for the active file or task        |
| `CodeAtlas: Generate Git PR Context`                      | Creates an architectural blast-radius summary for Pull Requests        |
| `CodeAtlas: Generate AI Agent Rules`                      | Generates evidence-backed guidelines for AI assistants                 |
| `CodeAtlas: Run Cypher Graph Query`                       | Executes graph queries across codebase dependencies                    |
| `CodeAtlas: Toggle Real-time Watcher`                     | Enables/disables live background indexing on file save (`Ctrl+S`)      |
| `CodeAtlas: Start MCP Server`                             | Starts Model Context Protocol stdio server                             |
| `CodeAtlas: Run Architecture Audit`                       | Audits security vulnerabilities, DDD layers, and dead code             |
| `CodeAtlas: Search Codebase Symbols`                      | Full-text and symbol search with BM25 ranking                          |
| `CodeAtlas: Initialize Workspace`                         | Initializes CodeAtlas `.atlas/` database                               |
| `CodeAtlas: Scan Workspace`                               | Fast metadata and tech-stack structure scan                            |
| `CodeAtlas: Run Health Diagnostics`                       | Evaluates overall repository health score (0-100)                      |
| `CodeAtlas: Validate AI Rules`                            | Validates rule syntax and detects conflicting instructions             |
| `CodeAtlas: Clean Cache & Database`                       | Safely resets and clears local SQLite cache                            |

---

## Editor Shortcuts & Context Menus

- **CodeLens:** Click `⚡ Explain with Graph` above any symbol definition to zoom to its node.
- **Status Bar:** Click `$(flame) Blast: X files` in the bottom-right corner for impact radius.
- **Explorer Context Menu:** Right-click any file or directory ➔ **CodeAtlas: Export Context for AI Agent**.
- **Editor Title Bar:** Click the **Graph** icon to view the dependency radius of the active file.

---

## Extension Settings

| Setting                           | Default | Description                                                     |
| :-------------------------------- | :------ | :-------------------------------------------------------------- |
| `codeatlas.autoIndexOnSave`       | `true`  | Update AST symbols incrementally when files are saved.          |
| `codeatlas.defaultGraphDimension` | `"3D"`  | Default graph layout dimension (`"3D"` WebGL or `"2D"` Canvas). |
| `codeatlas.maxContextTokens`      | `12000` | Token budget limit for generated AI context packs.              |

---

## License

MIT © 2026-present CodeAtlas Contributors.

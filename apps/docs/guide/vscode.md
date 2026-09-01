# VS Code Extension Manual

The official **CodeAtlas VS Code Extension** integrates AST indexing, symbol navigation, AI rule synchronization, and interactive architecture visualization into Visual Studio Code, Google Antigravity, Cursor, and Windsurf.

---

## 🧭 Sidebar Views

The CodeAtlas Activity Bar provides 4 dedicated panels:

### 1. Architecture & Codebase Map

- **Open Architecture Map**: Launches the interactive 2D/3D force-directed dependency canvas.
- **Files Explorer**: Tree view of all indexed files and directory structures.
- **Symbols Explorer**: Comprehensive AST symbol navigation with cyclomatic complexity badges.

### 2. Architecture Health & Diagnostics

- **Architecture Layers**: Domain-Driven Design (DDD) module grouping and layer inspection.
- **Circular Imports**: Real-time cycle detection to prevent recursive initialization bugs.
- **Unreferenced Files**: Instant detection of dead/orphaned code with 0 incoming dependencies.

### 3. AI Agent Rules & Governance

- **Rule Explorer**: Real-time discovery of rules from `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, etc.
- **Rule Generator**: Interactive creation of evidence-backed guidelines with codebase citations.

### 4. Quick Actions & AI Tools

Instant access to all core CodeAtlas features directly from the sidebar:

- **Analyze Blast Radius**: Live impact analysis of active file and 1-click AI prompt export.
- **Sync AI Rules**: Injects live architecture DAG blueprints into `.cursorrules` / `CLAUDE.md`.
- **Multi-Repo & Microservices Map**: Aggregates monorepos or polyrepos into a global architecture network.
- **Export Architecture Schema**: Generates `.codeatlas.json` for service mesh sharing.
- **Quick Scan Workspace**: Instant tech-stack and project metadata scan.
- **Export Context Pack**: Token-budgeted AST signature export for AI prompts.
- **Generate AI Rules**: Evidence-backed rule synthesis for your AI assistants.
- **Architecture Audit**: Security SAST scan and layer compliance audit.
- **Semantic Codebase Search**: FTS5 BM25 search across symbols and code.
- **Start MCP Server**: Launch Model Context Protocol server.
- **Analyze PR Impact**: Architectural blast-radius analysis for Pull Requests.
- **Health Diagnostics**: Comprehensive repository health scoring (0-100).
- **Query Graph (NL/Cypher)**: Natural language and Cypher query interface.
- **Toggle Real-time Watcher**: Live background re-indexing on file save.
- **Initialize Workspace**: Set up `.atlas/` intelligence database.
- **Clean Cache & DB**: Reset and clear local SQLite cache safely.

---

## ⌨️ Command Palette Actions

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type `CodeAtlas`:

| Command Identifier                   | Title                                                     | Description                                                                    |
| ------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `codeatlas.openGraphView`            | `CodeAtlas: Open Interactive Graph View`                  | Opens the 2D/3D architecture graph visualizer tab with 7 heatmap modes         |
| `codeatlas.indexCodebase`            | `CodeAtlas: Index / Refresh Codebase`                     | Triggers full workspace AST re-indexing                                        |
| `codeatlas.analyzeBlastRadius`       | `CodeAtlas: Analyze Blast Radius Impact`                  | Real-time impact analysis of active file and 1-click prompt export for AI      |
| `codeatlas.syncAIRules`              | `CodeAtlas: Sync AI Rules & Architecture Map`             | Synchronizes live DAG architecture blueprint into `.cursorrules` / `CLAUDE.md` |
| `codeatlas.openMultiRepoAggregator`  | `CodeAtlas: Open Multi-Repo & Microservices Map`          | Aggregates monorepos or polyrepos into a global architecture network           |
| `codeatlas.exportArchitectureSchema` | `CodeAtlas: Export Architecture Schema (.codeatlas.json)` | Exports service schema for multi-repo sharing and service mesh mapping         |
| `codeatlas.exportContext`            | `CodeAtlas: Export Context for AI Agent`                  | Generates compressed AST signatures for AI prompts                             |
| `codeatlas.generatePRContext`        | `CodeAtlas: Generate Git PR Context`                      | Creates architectural blast-radius summary for PRs                             |
| `codeatlas.generateRules`            | `CodeAtlas: Generate AI Agent Rules`                      | Generates evidence-backed guidelines for AI agents                             |
| `codeatlas.queryGraph`               | `CodeAtlas: Run Cypher Graph Query`                       | Executes graph queries across codebase dependencies                            |
| `codeatlas.toggleWatcher`            | `CodeAtlas: Toggle Real-time Watcher`                     | Enables/disables live indexing on file save                                    |
| `codeatlas.startMCP`                 | `CodeAtlas: Start MCP Server`                             | Starts Model Context Protocol stdio server                                     |
| `codeatlas.runAudit`                 | `CodeAtlas: Run Architecture Audit`                       | Audits security, layers, and dead code                                         |
| `codeatlas.semanticSearch`           | `CodeAtlas: Search Codebase Symbols`                      | Full-text and symbol search with BM25 ranking                                  |
| `codeatlas.init`                     | `CodeAtlas: Initialize Workspace`                         | Initializes CodeAtlas `.atlas/` database                                       |
| `codeatlas.scan`                     | `CodeAtlas: Scan Workspace`                               | Fast metadata and structure scan                                               |
| `codeatlas.doctor`                   | `CodeAtlas: Run Health Diagnostics`                       | Evaluates overall repository health score                                      |
| `codeatlas.rulesValidate`            | `CodeAtlas: Validate AI Rules`                            | Checks for rule conflicts and contradictions                                   |
| `codeatlas.clean`                    | `CodeAtlas: Clean Cache & Database`                       | Safely clears local index cache                                                |

---

## 🖱️ Editor, CodeLens & Status Bar Integration

- **CodeLens "Explain with Graph"**: Click `⚡ Explain with Graph` above any function, class, or at the top of any file to auto-focus the visualizer camera on that node's dependency cluster.
- **Status Bar Telemetry**: Click `$(flame) Blast: X files (RISK)` in the bottom-right status bar to immediately inspect direct and cascading impact radius.
- **Editor Title Bar**: Click the dedicated **Graph** icon on any active editor tab to visualize its dependency radius.
- **Explorer Context Menu**: Right-click any file or folder to export a token-optimized context pack.
- **Linter & Auto-Repair**: Real-time warnings for circular dependencies and layer regressions with QuickFix refactoring actions.

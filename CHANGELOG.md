# Changelog - CodeAtlas

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://www.conventionalcommits.org/) for commit guidelines.

## [2.1.0] - 2026-09-03

### Universal MCP Subsystem Overhaul & Multi-Agent Ecosystem

#### 🚀 New Features & Enhancements

- **22 High-Performance MCP Tools**: Expanded MCP tool catalog from 16 to 22 specialized tools covering complete codebase topology:
  - `atlas_scan`: High-speed codebase scanning and metadata summary.
  - `atlas_impact`: Blast radius and cascading impact analyzer.
  - `atlas_dependencies`: Direct incoming and outgoing dependency mapping.
  - `atlas_cycles`: Tarjan SCC cycle and circular dependency detector.
  - `atlas_context`: Context pack generation with token budgeting.
  - `atlas_query`: Graph database query execution.
  - `atlas_architecture`: High-level architecture map and layer boundaries.
  - `atlas_suggest_refactoring`: Automated refactoring opportunities.
  - `atlas_generate_rules`: Live DAG rules generation for AI assistants.
  - `atlas_search_symbols`: Cross-codebase symbol and declaration search.
  - `atlas_get_god_components`: High-churn, low-cohesion component detection.
  - `atlas_get_dead_code`: Unused symbol and orphaned file detector.
  - `atlas_get_bottlenecks`: Critical path and architectural bottleneck analyzer.
  - `atlas_calculate_change_surface`: Pre-PR change impact surface calculation.
  - `atlas_get_file_context`: Targeted file context with topological neighbors.
  - And 7 additional foundational analysis tools.

- **Universal 1-Click MCP Configurator (`atlas mcp setup`)**:
  - Support for 9 major AI coding assistants and environments: **Cursor, Claude Desktop, Antigravity, Cline, Roo Code, Continue, Windsurf, Zed, and VS Code**.
  - **JSONC Safe-Merge Engine**: Strips single-line (`//`), multi-line (`/* */`) comments and trailing commas while preserving all existing user settings and comment structures.
  - **Smart Command Resolver**: Automatically discovers node/npx/cli binary paths across version managers (NVM, FNM, Volta, ASDF, Homebrew) and project `node_modules`.

- **Pure stdio Protocol Isolation**:
  - Complete redirection of internal logging to `stderr` under MCP mode (`CODEATLAS_MCP=1`).
  - Guarantees clean, uncorrupted JSON-RPC 2.0 framing over `stdout`.

- **MCP Health Diagnostics (`atlas mcp doctor`)**:
  - Interactive end-to-end handshake verification with live protocol version checks and tool listing diagnostics.
  - Automatic pipe deadlock prevention on Windows and Unix platforms.

- **Robust Process Lifecycle Management**:
  - Added stream termination hooks (`rl.on('close')`) and OS signal listeners (`SIGINT`, `SIGTERM`) to cleanly disconnect SQLite databases and prevent orphan background processes.

- **Official VS Code Extension v2.1.0**:
  - Packaged and optimized `.vsix` ready for release and distribution.

---

## [2.0.0] - 2026-08-28

### Major Release

- **7-Mode Architecture Heatmap**: Interactive 2D/3D WebGL force-directed graph canvas with real-time coloring for Language, Clusters, Git Churn, Instability, Blast Radius Impact, Debt Hotspots, and Lines of Code.
- **Live Blast Radius Impact Analysis**: Real-time Status Bar monitor and QuickPick analyzer computing direct and cascading breakages with 1-click prompt export for AI assistants.
- **Automated AI Rules & Live Architecture Blueprint Sync**: Injects and synchronizes live DAG architecture summaries into `.cursor/rules/`, `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md`.
- **AI Linter Guard & Auto-Repair**: Active editor diagnostics for circular import cycles (Tarjan SCC) and DDD layer regressions with QuickFix code actions.
- **Multi-Repo & Microservices Global Mesh Aggregator**: Aggregate monorepo packages or decentralized polyrepos into a unified service mesh with automated HTTP endpoint-to-client discovery.
- **Universal Polyglot Language Engine**: Concrete syntax tree parsing and dependency extraction for Dart, Scala, Lua, Elixir, Erlang, Zig, GraphQL, Vue, Svelte, Astro, and SQL schemas.
- **SQLite FTS5 Re-indexing Fixes**: Robust SQLite full-text search index handling with zero constraint collisions on re-index.

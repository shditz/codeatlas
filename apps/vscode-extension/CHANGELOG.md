# Change Log - CodeAtlas Official Extension

All notable changes to the "CodeAtlas" extension will be documented in this file.

## 2.1.0

### Minor Release

- **Universal MCP Server Support**: Full integration with the CodeAtlas 2.1.0 MCP server and 22 analysis tools.
- **Enhanced Graph Telemetry & Stability**: Improved performance during live blast radius calculations and deep symbol resolutions.
- **Packaging & Engine Optimizations**: Updated to latest bundling pipeline for minimal vsix bundle size and instant activation.

## 2.0.0

### Major Release

- **7-Mode Architecture Heatmap**: Interactive 2D/3D WebGL force-directed graph canvas with real-time coloring for Language, Clusters, Git Churn, Instability, Blast Radius Impact, Debt Hotspots, and Lines of Code.
- **Live Blast Radius Telemetry**: Status Bar indicator (`$(flame) Blast: X files`) and QuickPick impact analysis showing direct and cascading callers with 1-click prompt export for AI assistants.
- **Automated AI Rules & Live Architecture Blueprint Sync**: Injects and synchronizes live DAG architecture summaries into `.cursor/rules/`, `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md`.
- **AI Linter Guard & Auto-Repair**: Active editor diagnostics for circular import cycles (Tarjan SCC) and DDD layer regressions with QuickFix code actions.
- **Multi-Repo & Microservices Global Mesh Aggregator**: Aggregate monorepo packages or decentralized polyrepos into a unified service mesh with automated HTTP endpoint-to-client discovery.
- **CodeLens "Explain with Graph"**: 1-click CodeLens above classes, functions, and interfaces to focus the visualizer camera directly on local dependencies.
- **Universal Polyglot Language Engine**: Concrete syntax tree parsing and dependency extraction for Dart, Scala, Lua, Elixir, Erlang, Zig, GraphQL, Vue, Svelte, Astro, and SQL schemas.

---
layout: home

hero:
  name: 'CodeAtlas'
  text: 'Codebase Indexer & Context Engine'
  tagline: 'Local AST indexing, dependency graph visualization, and automated context generation for AI coding assistants.'
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Architecture
      link: /guide/architecture
    - theme: alt
      text: GitHub
      link: https://github.com/shditz/codeatlas

features:
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'
    title: Dependency Graph Visualizer
    details: Interactive 2D and 3D force-directed graph to inspect directory structures, file imports, and cross-module relationships directly in VS Code.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
    title: Local-First & Private
    details: All AST parsing, SQLite caching, and context operations run locally. Zero telemetry, tracking, or network transmission of source code.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h6"/></svg>'
    title: Universal AI Rules Exporter
    details: Automatically compiles project conventions, typing standards, and architectural rules into .cursorrules, CLAUDE.md, .windsurfrules, and DEVIN.md.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>'
    title: Multi-Language AST Parsing
    details: High-speed Tree-sitter parsers supporting TypeScript, JavaScript, Python, PHP, Go, Rust, HTML, and CSS with incremental file hash caching.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="M2 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M12 22v-4"/><path d="m19.07 19.07-2.83-2.83"/><path d="M22 12h-4"/><path d="m19.07 4.93-2.83 2.83"/></svg>'
    title: Model Context Protocol (MCP)
    details: Exposes symbol definitions, repository maps, and context packs to Claude Desktop and MCP-compatible AI assistants over JSON-RPC.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>'
    title: Context Compression
    details: Packages large repositories into token-budgeted prompt windows using structural interface digests and BM25 relevance scoring.
---

## Quick Start

### 1. Installation

```bash
# Clone and link globally
git clone https://github.com/shditz/codeatlas.git
cd codeatlas
pnpm install && pnpm build
pnpm --filter @codeatlas-ai/cli link --global
```

### 2. Index Repository

```bash
atlas index
```

### 3. Generate Agent Rules

```bash
atlas rules --all
```

### 4. Launch Graph Visualizer

```bash
atlas graph
```

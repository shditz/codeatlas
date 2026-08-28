---
layout: home

hero:
  name: 'CodeAtlas'
  text: 'Context Intelligence & Architecture Engine'
  tagline: 'Local-first AST indexing, SQLite dependency graphs, and token-optimized context packs for AI coding assistants.'
  actions:
    - theme: brand
      text: 🚀 Get Started
      link: /guide/getting-started
    - theme: alt
      text: 💻 CLI Reference
      link: /guide/cli
    - theme: alt
      text: 🔌 MCP Server
      link: /guide/mcp
    - theme: alt
      text: GitHub
      link: https://github.com/shditz/codeatlas

features:
  - icon: '🗺️'
    title: Local-First Knowledge Graph
    details: Automatically parses your codebase into an embedded SQLite database (.atlas/atlas.db). 100% private, offline, and blazing fast.
  - icon: '🧠'
    title: Smart Context Engine
    details: Compresses files into AST signature skeletons. Feed your AI exact, explainable context packs and save up to 80% on LLM tokens.
  - icon: '🔌'
    title: Native MCP Server
    details: Plug directly into Google Antigravity, Claude Code, Cursor, and Cline with 11 native MCP tools for real-time code exploration.
  - icon: '📜'
    title: Universal AI Rules Generator
    details: Auto-compiles project guidelines (AGENTS.md, CLAUDE.md, .cursorrules) customized for your specific frameworks and monorepo structure.
  - icon: '🛡️'
    title: Architecture Health Audit
    details: Detects Dead Code, Circular Dependencies, God Objects, and Git Churn Hotspots to stop technical debt before it merges.
  - icon: '💬'
    title: Natural Language Query (NL2Cypher)
    details: Ask questions in plain English or Cypher to find dependencies, callers, and structural patterns instantly.
---

## ⚡ Quick Start in 3 Steps

### 1. Install Globally
```bash
npm install -g @codeatlas-ai/cli
```

### 2. Initialize & Index Your Project
```bash
cd /path/to/my-project
atlas init
atlas index
```

### 3. Generate AI Guidelines
```bash
atlas rules generate all
```

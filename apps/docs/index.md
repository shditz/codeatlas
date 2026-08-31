---
layout: home

hero:
  name: 'CodeAtlas'
  text: 'Context Intelligence & Architecture Engine'
  tagline: 'Local-first AST indexing, SQLite dependency graphs, DDD layer regression guards, and token-optimized context packs for AI coding assistants.'
  actions:
    - theme: brand
      text: 🚀 Get Started
      link: /guide/getting-started
    - theme: alt
      text: 💻 CLI Reference
      link: /guide/cli
    - theme: alt
      text: 🔌 MCP Server (16 Tools)
      link: /guide/mcp
    - theme: alt
      text: GitHub
      link: https://github.com/shditz/codeatlas

features:
  - icon: '🗺️'
    title: Local-First Knowledge Graph
    details: Automatically parses your codebase into an embedded SQLite database (.atlas/atlas.db). 100% private, offline, and blazing fast.
  - icon: '🔒'
    title: Automated Secret Redaction
    details: High-entropy SecretScanner prevents Cloud API keys, JWTs, and DB passwords from entering search indexes or leaking to LLMs.
  - icon: '🧩'
    title: Framework Semantic Adapters
    details: Deep understanding of React Hooks (use*), Next.js App Router (page/layout/route), NestJS DI (@Controller/@Injectable), and Prisma Schemas.
  - icon: '🏛️'
    title: True Architecture DDD Guardrails
    details: Enforces Presentation, Application, Domain, Infrastructure, and Shared boundaries. Prevents architectural regressions in CI/CD.
  - icon: '🧠'
    title: Task-Aware Context Engine
    details: Intent-driven retrieval (bug, feature, refactor) with AST skeleton compression, saving up to 92% on token budgets.
  - icon: '🔌'
    title: 16 Native MCP Tools
    details: Real-time integration into Antigravity, Claude Code, Cursor, and Windsurf for deep call chain tracing and feature blueprint planning.
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

### 3. Generate Evidence-Backed AI Guidelines

```bash
atlas rules generate all -y
```

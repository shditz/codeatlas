# 🤖 AI Agent Workflow Best Practices

How to achieve maximum accuracy and zero regressions when pairing CodeAtlas with AI Coding Assistants (**Google Antigravity**, **Claude Code**, **Cursor**, and **Windsurf**).

---

## 🌟 The Golden Formula: MCP Tools + Evidence-Backed Rules

To make your AI agent perform at its peak, two systems work in tandem:

```
🚀 Peak AI Performance = MCP Server (16 Tools) + AGENTS.md (Evidence-Backed Rules)
```

1. **The Tools (MCP Server)**: Gives your AI the *ability* to query AST symbols, trace call chains, and calculate downstream impact.
2. **The Motivation (`AGENTS.md` / `.cursorrules`)**: Gives your AI explicit *instructions* to query CodeAtlas before making assumptions or modifying critical files.

---

## 🔄 The 4-Step Daily Workflow

### Step 1: Initialize & Generate Rules (Once per Project)

In your project root:

```bash
atlas init
atlas index
atlas rules generate all -y
```

This creates tailored instruction files (like `AGENTS.md` or `.cursorrules`) that teach your AI about your TypeScript conventions, DDD layers, monorepo workspaces, and architectural boundaries.

---

### Step 2: Task-Intent Driven Prompting

When asking an AI agent to build a feature or fix a bug, specify the task intent:

**Prompt to AI:**

> _"Use `atlas_get_context` with task 'Fix database connection timeout under high load' and intent 'bug'. Review the retrieved files and identify the root cause."_

CodeAtlas dynamically prioritizes error handlers, connection pools, and call chains, feeding the AI exactly the right files with zero token waste.

---

### Step 3: Deep Call Hierarchy Tracing

Before modifying shared utility functions or core service methods, instruct the AI to check callers and entry points:

**Prompt to AI:**

> _"Use `atlas_trace_execution_path` for `AuthService.validateToken` in direction 'upstream' to verify all controllers and route handlers that depend on this method."_

---

### Step 4: Architecture Self-Audit (Pre-Completion)

Before your AI agent marks a task as complete, instruct it to run an architectural self-audit:

**Prompt to AI:**

> _"Run `atlas_analyze` (or `atlas analyze --architecture` in the terminal). Make sure your changes did not introduce any DDD layer regressions, public API bypasses, circular dependencies, or dead code."_

If the AI accidentally imported a private module (e.g. bypassing a public API boundary), `atlas analyze` flags the violation and the AI refactors it before code review!

---

## 🛡️ CI/CD Integration (GitHub Actions)

Add CodeAtlas as an automated quality gate in `.github/workflows/codeatlas.yml`:

```yaml
name: CodeAtlas Architecture Gate

on:
  pull_request:
    branches: [main, master]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: pnpm install

      - name: Build & Index CodeAtlas
        run: |
          npx @codeatlas-ai/cli index
          npx @codeatlas-ai/cli doctor

      - name: Fail on DDD Layer Regressions
        run: npx @codeatlas-ai/cli analyze --architecture --fail-on-architecture

      - name: Fail on Circular Dependencies
        run: npx @codeatlas-ai/cli analyze --fail-on-cycles
```

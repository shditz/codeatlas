# 🚀 Getting Started

Welcome to **CodeAtlas**! This guide is designed for **developers, engineers, and AI agent builders**. You will learn how to install CodeAtlas, scan your project, connect it to your favorite AI assistant (Google Antigravity, Claude Code, Cursor, Windsurf), and supercharge your coding workflow in less than 3 minutes.

---

## 💡 What is CodeAtlas?

Imagine your codebase as a complex city. Without a structural map, your AI assistant is walking through every directory trying to guess where dependencies live—wasting expensive context tokens and introducing regressions.

**CodeAtlas is the architectural GPS for your AI.** It scans your project, builds a local SQLite knowledge graph of all functions, classes, imports, and DDD layers, and provides your AI with exact, secret-redacted context on demand.

---

## 📦 1. Installation

### Method 1: Global NPM Install (Recommended)

Open your terminal (PowerShell, Command Prompt, or Bash) and run:

```bash
npm install -g @codeatlas-ai/cli
```

Verify that it works:

```bash
atlas --version
```

### Method 2: Installing from Source (For Contributors)

```bash
# 1. Clone repo
git clone https://github.com/shditz/codeatlas.git
cd codeatlas

# 2. Install dependencies & build
pnpm install
pnpm build

# 3. Link globally
pnpm --filter @codeatlas-ai/cli link --global
```

---

## 🏃 2. Your First CodeAtlas Project (Step-by-Step)

### Step 1: Initialize Your Workspace

Navigate to your project's folder and run:

```bash
cd /path/to/my-project
atlas init
```

> **What just happened?**
> CodeAtlas created a hidden `.atlas/` folder containing your local database (`atlas.db`) and configuration file (`config.toml`). Everything is stored locally on your machine—no code ever leaves your computer!

### Step 2: Index the Codebase

Now tell CodeAtlas to scan and understand your code:

```bash
atlas index
```

CodeAtlas extracts AST symbols, computes cyclomatic complexity, links dependency graphs, and automatically applies `SecretScanner` redaction.

### Step 3: Audit Architecture & Health

Run health diagnostics and architecture layering audits:

```bash
# Check overall index health and completeness
atlas doctor

# Audit DDD layers and check for architectural regressions
atlas analyze --architecture
```

### Step 4: Teach Your AI Coding Assistant

Generate evidence-backed guideline files customized for your specific frameworks and monorepo structure:

```bash
# Generate a proposal document for review
atlas rules generate --proposal

# Or generate directly for all AI platforms
atlas rules generate all -y
```

---

## 🤖 3. Connect to Your AI Coding Assistant (1-Click Setup)

The real power happens when your AI Coding Assistant connects to CodeAtlas via **MCP (Model Context Protocol)**.

Run the automated configurator:

```bash
atlas mcp setup
```

This interactive command automatically detects your installed AI assistants (Google Antigravity, Cursor, Claude Desktop, Claude Code, Windsurf, Roo Code, Trae, Zed, Continue) and safely writes the necessary configuration without overwriting existing tools.

You can also run non-interactively:

```bash
# Configure all detected AI assistants automatically
atlas mcp setup --all
```

---

## 🎯 4. Daily Cheat Sheet

Here is how you use CodeAtlas while coding every day:

- **Need context for a specific task?**
  ```bash
  atlas context "fix authentication race condition" --intent bug --budget 4000
  ```
- **Want to audit your code for circular dependencies or dead code?**
  ```bash
  atlas analyze --cycles
  atlas analyze --dead-code
  ```
- **Checking what your git changes might break before committing?**
  ```bash
  atlas diff
  ```
- **Want real-time indexing while you write code?**
  ```bash
  atlas watch
  ```

---

## ⏭️ Next Steps

- Explore all 16 commands in the [CLI Reference](/guide/cli).
- Learn about [System Architecture & DDD Layering](/guide/architecture).
- Deep dive into the [16 Model Context Protocol (MCP) Tools](/guide/mcp).

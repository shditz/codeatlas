<div align="center">
  <img src="assets/banner.jpg" alt="CodeAtlas Banner" width="100%" />
</div>

# CodeAtlas 🗺️

> **The Local-First Context Intelligence & Architecture Engine for AI Coding Agents**

CodeAtlas turns your codebase into a high-performance **Knowledge Graph** stored locally in an embedded SQLite database (`.atlas/atlas.db`). It gives AI coding assistants (like **Claude Code**, **Google Antigravity**, **Cursor**, and **Windsurf**) X-Ray vision into your codebase—saving up to 80% on token costs, eliminating hallucinations, and stopping architecture regressions before they reach production.

[![CI](https://github.com/shditz/codeatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/shditz/codeatlas/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green?logo=node.js)](https://nodejs.org/)

---

## 🚀 Why CodeAtlas?

When AI agents work on large codebases, they struggle with two main problems:

1. **Blindness / Hallucination**: AI doesn't know which function imports what, often leading to broken dependencies and regressions.
2. **Token Waste**: Dumping entire source files into an LLM context window is slow and expensive.

**CodeAtlas solves this:**

- ⚡ **Local-First & 100% Private**: Everything is indexed locally into SQLite with Tree-sitter. No code is uploaded to the cloud.
- 🧠 **Smart Context Budgeting**: Compresses files into AST signatures so AI gets 100% of the architectural context using 20% of the tokens. Includes visual Directory Tree Packing!
- 🛡️ **Architectural Guardrails**: Automatically detects **Dead Code**, **Circular Dependencies**, and **Complexity Hotspots**.
- 🚀 **Zero-Config Setup**: `atlas init` automatically detects your stack and generates smart ignore rules.
- 🔌 **Native Model Context Protocol (MCP)**: Plugs directly into Antigravity, Claude Desktop, Cursor, and Cline as a real-time brain extension (Includes `atlas_detect_dead_code` & `atlas_complexity_report`).

---

## 📦 Quick Start in 3 Minutes

### 1. Install Globally

```bash
npm install -g @codeatlas-ai/cli
```

_(Or build locally from source with `pnpm install && pnpm build && pnpm --filter @codeatlas-ai/cli link --global`)_

### 2. Initialize in Your Project

Navigate to any project directory and initialize CodeAtlas:

```bash
# Initialize local configuration and database (.atlas/)
atlas init

# Parse AST structures and build the dependency graph
atlas index
```

### 3. Generate AI Guidelines

Auto-generate architecture rules customized for your AI assistant:

```bash
# Generate rules for Antigravity (creates AGENTS.md)
atlas rules generate antigravity

# Or generate for Claude, Cursor, Copilot, Windsurf, etc.
atlas rules generate all
```

---

## 🛠️ CLI Commands Cheat Sheet

| Command                | Category        | Description                                                                                  |
| :--------------------- | :-------------- | :------------------------------------------------------------------------------------------- |
| `atlas init`           | **Setup**       | Initializes `.atlas/` folder and `config.toml`.                                              |
| `atlas scan`           | **Setup**       | Fast scan detecting languages, frameworks, and monorepos.                                    |
| `atlas index`          | **Core**        | Parses AST with Tree-sitter and builds the SQLite graph.                                     |
| `atlas clean`          | **Maintenance** | Cleans local cache, database, and snapshots.                                                 |
| `atlas doctor`         | **Quality**     | Runs repository health checks and provides a readiness score.                                |
| `atlas analyze`        | **Quality**     | Audits codebase for Dead Code, Circular Imports, and Git Churn Hotspots.                     |
| `atlas diff`           | **Quality**     | Calculates blast radius and affected files from Git diffs.                                   |
| `atlas pr`             | **Quality**     | Generates an architectural PR summary for AI Code Reviews.                                   |
| `atlas context`        | **AI Context**  | Extracts token-budgeted prompt packs for a given coding task.                                |
| `atlas export`         | **AI Context**  | Exports context packs into Markdown files for LLM chats.                                     |
| `atlas query`          | **Search**      | Natural language (NL2Cypher) or Cypher graph queries.                                        |
| `atlas search`         | **Search**      | Full-text keyword search via SQLite FTS5 (BM25 ranking).                                     |
| `atlas map`            | **Visual**      | Displays an ASCII tree map of directories and exported symbols.                              |
| `atlas rules list`     | **Rules**       | Lists all discovered AI rule files.                                                          |
| `atlas rules validate` | **Rules**       | Checks for rule conflicts and consistency.                                                   |
| `atlas rules generate` | **Rules**       | Generates guideline files for specific AI editors (`cursor`, `claude`, `antigravity`, etc.). |
| `atlas mcp`            | **Integration** | Starts the official Model Context Protocol (MCP) server over `stdio`.                        |

---

## 🤖 Model Context Protocol (MCP) Integration

Connect CodeAtlas directly to your AI Coding Assistant so it can query the codebase on-demand:

### Google Antigravity

Add to your project's `.agents/mcp_config.json` or global `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "codeatlas": {
      "command": "atlas",
      "args": ["mcp"]
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add codeatlas atlas -- mcp
```

### Claude Desktop

Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "codeatlas": {
      "command": "atlas",
      "args": ["mcp"]
    }
  }
}
```

---

## ⚙️ Configuration (`.atlas/config.toml`)

CodeAtlas configuration is stored in `.atlas/config.toml` in clean TOML format:

```toml
[project]
name = "MyAwesomeProject"

[index]
follow_symlinks = false
include_tests = true
max_file_size = 1048576

[context]
max_tokens = 12000
default_mode = "full" # "full", "signature", "summary", or "digest"

[security]
scan_secrets = true
exclude_patterns = [".env", "*.pem", "*.key"]
```

---

## 📖 Web Documentation

To run the full interactive documentation portal locally:

```bash
pnpm run docs:dev
```

Then visit [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📄 License

MIT © 2026-present CodeAtlas Contributors.

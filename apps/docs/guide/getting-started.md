# 🚀 Getting Started

Welcome to **CodeAtlas**! This guide is designed for **beginners, junior developers, and vibe coders**. You will learn how to install CodeAtlas, scan your project, connect it to your favorite AI assistant (Claude Code, Google Antigravity, Cursor, Windsurf), and supercharge your coding workflow in less than 5 minutes.

---

## 💡 What is CodeAtlas?

Imagine your codebase as a giant city. Without a map, your AI assistant is walking through every alleyway trying to find the right building—wasting your time and burning expensive tokens.

**CodeAtlas is the GPS navigation system for your AI.** It scans your project, builds a local map of all functions, classes, and imports, and tells your AI exactly where to go.

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

Let's set up CodeAtlas on an existing project on your machine!

### Step 1: Initialize Your Workspace

Navigate to your project's folder and run:

```bash
cd /path/to/my-project
atlas init
```

> **What just happened?**
> CodeAtlas created a hidden `.atlas/` folder containing your local database (`atlas.db`) and configuration file (`config.toml`). Everything is stored on your machine—no code ever leaves your computer!

### Step 2: Index the Codebase

Now tell CodeAtlas to scan and understand your code:

```bash
atlas index
```

You will see output like this:

```
14:37:14 INFO [indexer:scanner] Scan complete: 242 files in 60ms
14:37:14 INFO [indexer] Indexing complete: 242 files, 740 symbols, 155 deps
Index Results
  ✓ Files indexed     242
  ◆ Symbols          740
  → Imports          155
```

### Step 3: Check Codebase Health

Run the doctor diagnostic to make sure everything is healthy:

```bash
atlas doctor
```

CodeAtlas will give your repository a health score (0-100) and tell you if anything needs attention.

### Step 4: Teach Your AI Coding Assistant

Generate tailor-made instructions so your AI knows how to work with your project's tech stack:

```bash
# If using Google Antigravity
atlas rules generate antigravity

# If using Claude Code / Claude Desktop
atlas rules generate claude

# If using Cursor
atlas rules generate cursor

# Or generate for everyone at once!
atlas rules generate all
```

---

## 🤖 3. Hooking CodeAtlas into AI Coding Agents

The real magic happens when your AI Coding Assistant connects to CodeAtlas via **MCP (Model Context Protocol)**.

### For Google Antigravity:

1. In your project root, create a file named `.agents/mcp_config.json`:

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

### For Claude Code CLI:

Run in your terminal:

```bash
claude mcp add codeatlas atlas -- mcp
```

### For Claude Desktop:

Add this to your Claude Desktop config:

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

## 🎯 4. Daily Cheat Sheet

Here is how you use CodeAtlas while coding every day:

- **Need context for a prompt?**
  ```bash
  atlas context "how does the user authentication token work?" --budget 3000
  ```
- **Want to audit your code for circular dependencies or dead code?**
  ```bash
  atlas analyze
  ```
- **Checking what your git changes might break?**
  ```bash
  atlas diff
  ```

---

## ⏭️ Next Steps

- Explore all 16 commands in the [CLI Reference](/guide/cli).
- Learn about the [Agent Workflow Best Practices](/guide/agents-workflow).
- Deep dive into the [Model Context Protocol (MCP)](/guide/mcp).

# 🤖 AI Agent Workflow Best Practices

How to get the absolute best results when pairing CodeAtlas with AI Coding Assistants (**Google Antigravity**, **Claude Code**, **Cursor**, and **Windsurf**).

---

## 🌟 The Golden Formula: MCP Tools + AI Rules

To make your AI agent perform at its peak, you need two things working together:

```
🚀 Peak AI Performance = MCP Server (The Tools) + AGENTS.md (The Motivation)
```

1. **The Tools (MCP Server)**: Gives your AI the *ability* to query AST symbols and dependencies.
2. **The Motivation (`AGENTS.md` / `.cursorrules`)**: Gives your AI explicit *instructions* to always check CodeAtlas before making assumptions or guessing file paths.

---

## 🔄 The 4-Step Daily Workflow

### Step 1: Initialize & Generate Rules (Once per Project)
In your project root:
```bash
atlas init
atlas index
atlas rules generate all
```
This creates tailored instruction files (like `AGENTS.md` or `.cursorrules`) that teach your AI about your TypeScript conventions, monorepo workspaces, and architectural boundaries.

---

### Step 2: Context-Driven Prompting
When asking an AI agent to build a feature, avoid vague prompts that force the AI to search blindly.

**❌ The Slow Way (Blind AI Search):**
> *"Please add a discount coupon feature to the checkout page."*
> *(AI reads 50 random files, burns tokens, and might edit the wrong service).*

**✅ The CodeAtlas Way (Precision Context):**
> *"Use `atlas_get_context` to fetch the context pack for 'discount coupon checkout', read the relevant files, and implement the feature."*
> *(AI retrieves the exact 4 files involved, understands their type interfaces, and implements the feature cleanly in 1 shot).*

---

### Step 3: Architecture Self-Audit (Pre-Completion)
Before your AI agent marks a task as complete, instruct it to run an architectural audit:

**Prompt to AI:**
> *"Run `atlas_analyze` (or `atlas analyze` in the terminal). Make sure your changes did not introduce any circular dependencies or dead code."*

If the AI accidentally created an import loop (e.g. `auth.ts` imports `user.ts` which imports `auth.ts`), `atlas analyze` flags it immediately and the AI refactors it before you ever commit!

---

### Step 4: Pre-Commit Blast Radius Check
Before submitting a Pull Request, run:

```bash
atlas diff
```
CodeAtlas will show you the **Blast Radius** of your changes—listing every other component or package in your project that depends on the files you just changed.

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

      - name: Fail on Circular Dependencies
        run: npx @codeatlas-ai/cli analyze --fail-on-cycles
```

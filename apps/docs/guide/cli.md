# 💻 CLI Reference Manual

The `atlas` CLI is your command center for indexing codebases, analyzing architecture, running graph queries, generating AI guidelines, and integrating with AI coding assistants.

---

## 🧭 Command Quick Reference

```
Usage: atlas [options] [command]

Commands:
  init [options]               Initialize CodeAtlas in the current directory
  scan                         Fast scan to detect project metadata and structure
  index [options] [path]       Index repository files, symbols, and dependencies (with secret redaction)
  watch [options]              Watch directory and update the knowledge graph in real time
  context <task> [options]     Retrieve intent-aware, token-budgeted context pack for a task
  export [options]             Export context pack to markdown or AI formats
  analyze [options]            Analyze codebase for DDD layer regressions, dead code, & hotspots
  diff [options]               Analyze git diff and show architectural blast radius
  doctor                       Run health checks on repository index and rules
  pr [options]                 Generate PR architecture summary for AI code review
  search <query> [options]     Full-text search for symbols and files (BM25 ranking)
  query <query> [options]      Query the codebase graph using natural language or Cypher
  map [options]                Display ASCII codebase tree and symbol map
  rules                        Manage and generate evidence-backed AI rules and guidelines
  clean [options]              Clean index database, cache, or snapshots
  mcp                          Model Context Protocol server (22 tools) & auto-configurator
  audit [options]              Run SAST and Data-Flow Taint Analysis
  install-hooks [options]      Install Git pre-commit hooks for auto-indexing
  link [targetPath]            Federate external repository databases
```

---

## 📋 Detailed Command Documentation

### 1. `atlas init`

Initializes a new CodeAtlas project by creating the `.atlas/` folder, local database `atlas.db`, and `config.toml`.

```bash
# Initialize CodeAtlas in the current directory
atlas init

# Force re-initialization (resets config)
atlas init --force
```

---

### 2. `atlas scan`

Scans the current repository without building a database. It quickly identifies:

- Programming languages & file counts
- Detected frameworks (React, Next.js, Express, NestJS, Prisma, etc.)
- Package manager (pnpm, npm, yarn, bun)
- Monorepo workspace configuration

```bash
atlas scan
```

---

### 3. `atlas index`

Parses all source code using Tree-sitter AST parsers, applies automated `SecretScanner` redaction, computes cyclomatic complexity, and commits symbols and relationships to `.atlas/atlas.db`.

```bash
# Incremental index (only updates modified files)
atlas index

# Force re-indexing of all files from scratch
atlas index --force

# Index a specific directory or package only
atlas index packages/core
```

---

### 4. `atlas watch`

Watches your workspace for filesystem modifications and updates AST symbols, dependencies, and temporal metrics incrementally in real time.

```bash
atlas watch
```

---

### 5. `atlas analyze`

Audits the architectural health of your codebase. It detects:

1. **True Architecture Regressions (`--architecture`)**: Domain-Driven Design (DDD) layer violations (e.g. Presentation calling Infrastructure directly, Domain depending on outer layers, or Public API bypasses).
2. **Circular Dependencies (`--cycles`)**: Recursive import cycles that cause runtime initialization bugs.
3. **Dead / Orphaned Code (`--dead-code`)**: Files and functions with 0 incoming dependencies.
4. **Git Churn Hotspots (`--hotspots`)**: Merges git commit frequency with coupling to highlight high-risk technical debt.

```bash
# Run full analysis
atlas analyze

# Audit DDD architecture layering and print clean score
atlas analyze --architecture

# Automatically fail CI pipeline if architectural regressions are detected
atlas analyze --architecture --fail-on-architecture

# Only check for circular dependencies
atlas analyze --cycles

# Output circular dependencies as a Mermaid diagram
atlas analyze --cycles --mermaid

# Only check for dead code
atlas analyze --dead-code

# Only check for structural hotspots
atlas analyze --hotspots
```

---

### 6. `atlas context`

Generates a token-optimized Context Pack tailored specifically for a prompt or task you want an AI to solve.

```bash
# Basic task context with default token budget (12,000 tokens)
atlas context "add Stripe webhook verification"

# Route retrieval specifically for a bug, feature, or refactoring intent
atlas context "fix auth token race condition" --intent bug
atlas context "implement shopping cart checkout" --intent feature
atlas context "extract database repository interface" --intent refactor

# Set a custom token budget limit
atlas context "refactor auth token" --budget 4000

# Select compression mode (full, signature, summary, digest)
atlas context "fix database connection leak" --mode signature

# Save output directly to a file
atlas context "build shopping cart" --output prompt-context.md
```

---

### 7. `atlas export`

Exports repository context into structured formats optimized for specific AI platforms.

```bash
# Export for Claude
atlas export --target claude --task "implement caching layer"

# Export for Cursor or Windsurf
atlas export --target cursor --output cursor-prompt.md
```

---

### 8. `atlas rules`

Manages AI prompt rules and generates evidence-backed guidelines for AI coding assistants.

#### `atlas rules list`

Lists all discovered rule files in the current repository:

```bash
atlas rules list
```

#### `atlas rules validate`

Validates your AI rules and detects conflicting instructions:

```bash
atlas rules validate
```

#### `atlas rules generate [target]`

Inspects codebase evidence (`tsconfig.json`, `package.json`, test configurations, architecture layers) and generates anti-hallucination rules with citations:

```bash
# Interactive selection with prompts
atlas rules generate

# Generate a proposal document (PROPOSED_RULES.md) for team code review
atlas rules generate --proposal

# Auto-accept all evidence-backed rules without prompts (for CI)
atlas rules generate all -y

# Generate specifically for Google Antigravity (creates AGENTS.md)
atlas rules generate antigravity

# Generate specifically for Claude (creates CLAUDE.md)
atlas rules generate claude

# Generate specifically for Cursor (creates .cursorrules)
atlas rules generate cursor
```

**Supported Targets:** `antigravity`, `agents`, `claude`, `cursor`, `windsurf`, `copilot`, `cline`, `trae`, `roo`, `continue`, `deepseek`, `lingma`, `all`.

---

### 9. `atlas diff`

Analyzes your git working directory or branch diff and calculates the **Blast Radius**—showing which other files and modules are impacted by your changes.

```bash
# Analyze uncommitted working directory changes
atlas diff

# Compare against a specific base branch
atlas diff --base main
```

---

### 10. `atlas doctor`

Runs a comprehensive repository health check and gives your project a health score (0–100).

```bash
atlas doctor
```

---

### 11. `atlas pr`

Generates a comprehensive Pull Request architectural summary suitable for AI Code Reviewers.

```bash
# Generate PR summary against main branch
atlas pr

# Compare against a custom branch
atlas pr --base develop
```

---

### 12. `atlas search`

Performs ultra-fast full-text and symbol search using SQLite FTS5 with BM25 ranking (secrets automatically redacted).

```bash
# Search for symbols, functions, or files
atlas search "UserRepository"

# Limit result count
atlas search "authenticate" --limit 10
```

---

### 13. `atlas query`

Runs graph queries against your codebase using plain English (Natural Language to Cypher) or Cypher directly:

```bash
# Natural language query
atlas query "find all files that import @codeatlas-ai/core"

# Cypher query
atlas query "MATCH (f:File)-[:IMPORTS]->(t:File) WHERE t.path CONTAINS 'storage' RETURN f.path"
```

---

### 14. `atlas map`

Prints a clean ASCII visual tree of your codebase and its exported symbols directly in the terminal.

```bash
atlas map --depth 4
```

---

### 15. `atlas clean`

Cleans up the `.atlas/` directory to reclaim disk space.

```bash
atlas clean
```

---

### 16. `atlas mcp`

Runs the Model Context Protocol (MCP) server or automatically configures integration for your AI coding assistants (Antigravity, Cursor, Claude, Windsurf, Roo, etc.).

```bash
# Start the MCP server over stdio (called automatically by AI assistants)
atlas mcp

# 1-Click Interactive setup: auto-detects and configures your AI coding assistants
atlas mcp setup

# Non-interactive configuration for all detected assistants
atlas mcp setup --all

# Configure specific assistants
atlas mcp setup --target cursor antigravity claude-desktop windsurf roo trae

# Preview configuration changes without writing to disk
atlas mcp setup --dry-run

# Run MCP server health diagnostics and handshake verification
atlas mcp doctor

# View all supported AI assistant targets and detection status
atlas mcp list-targets
```

---

### 17. `atlas audit`

Runs Static Application Security Testing (SAST) and Data-Flow Taint Analysis across your codebase to detect security vulnerabilities and unsafe data sinks.

```bash
# Run security audit on entire indexed codebase
atlas audit

# Audit a specific file only
atlas audit --file src/auth/jwt.ts

# Output JSON report (ideal for CI pipelines)
atlas audit --json

# Fail CI build if critical or high vulnerabilities are found
atlas audit --fail-on-vulnerabilities
```

---

### 18. `atlas install-hooks`

Installs native Git pre-commit hooks to automatically keep `.atlas/atlas.db` updated with staged changes on every `git commit`.

```bash
# Install pre-commit hook in .git/hooks/pre-commit
atlas install-hooks

# Force overwrite existing hook
atlas install-hooks --force
```

---

### 19. `atlas link`

Federates and attaches an external repository's SQLite database to the current CodeAtlas index for multi-repo monorepo cross-referencing.

```bash
# Link an external repository database
atlas link ../microservice-b --alias auth_service

# List all federated repositories
atlas link --list
```

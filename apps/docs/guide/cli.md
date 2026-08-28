# 💻 CLI Reference Manual

The `atlas` CLI is your command center for indexing codebases, analyzing architecture, running graph queries, and integrating with AI coding assistants.

---

## 🧭 Command Quick Reference

```
Usage: atlas [options] [command]

Commands:
  init [options]               Initialize CodeAtlas in the current directory
  scan                         Fast scan to detect project metadata and structure
  index [options] [path]       Index repository files, symbols, and dependencies
  clean [options]              Clean index database, cache, or snapshots
  doctor                       Run health checks on repository index and rules
  analyze [options]            Analyze codebase for dead code, circular dependencies, & hotspots
  context <task> [options]     Retrieve token-budgeted context pack for a task
  export [options]             Export context pack to markdown or AI formats
  query <query> [options]      Query the codebase graph using natural language or Cypher
  search <query> [options]     Full-text search for symbols and files (BM25 ranking)
  map [options]                Display ASCII codebase tree and symbol map
  rules                        Manage AI rules and instructions
  diff [options]               Analyze git diff and show architectural blast radius
  pr [options]                 Generate PR architecture summary for AI code review
  mcp                          Start the Model Context Protocol (MCP) server
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
- Detected frameworks (React, Next.js, Express, NestJS, etc.)
- Package manager (pnpm, npm, yarn, bun)
- Monorepo workspace configuration

```bash
atlas scan
```

---

### 3. `atlas index`

Parses all source code using Tree-sitter AST parsers and commits symbols, imports, and relationships to `.atlas/atlas.db`.

```bash
# Incremental index (only updates modified files)
atlas index

# Force re-indexing of all files from scratch
atlas index --force

# Index a specific directory or package only
atlas index packages/core
```

---

### 4. `atlas doctor`

Runs a comprehensive repository health check and gives your project a health score (0–100).

```bash
atlas doctor
```

**What it checks:**

- Index freshness & tracked files
- Dependency graph completeness
- AI rules presence and conflicts
- Symbol coverage ratio

---

### 5. `atlas analyze`

Audits the architectural health of your codebase. It detects:

1. **Circular Dependencies**: Recursive import cycles that cause runtime bugs (can output Mermaid diagrams).
2. **Dead / Orphaned Code**: Files and functions with 0 incoming dependencies.
3. **High Coupling & God Objects**: Modules with excessive in-degree or out-degree connections.
4. **Git Churn Hotspots**: Merges git history with coupling to highlight high-risk technical debt.

```bash
# Run full analysis
atlas analyze

# Only check for circular dependencies
atlas analyze --cycles

# Output circular dependencies as a Mermaid diagram
atlas analyze --cycles --mermaid

# Only check for dead code
atlas analyze --dead-code

# Only check for structural hotspots
atlas analyze --hotspots

# Automatically fail CI pipeline if circular dependencies are detected
atlas analyze --fail-on-cycles
```

---

### 6. `atlas context`

Generates a token-optimized Context Pack tailored specifically for a prompt or task you want an AI to solve.

```bash
# Basic task context with default token budget (12,000 tokens)
atlas context "add Stripe webhook verification"

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

### 8. `atlas query`

Runs graph queries against your codebase. You can ask in plain English (Natural Language to Cypher) or write Cypher queries directly!

```bash
# Natural language query
atlas query "find all files that import @codeatlas-ai/core"

# Cypher query
atlas query "MATCH (f:File)-[:IMPORTS]->(t:File) WHERE t.path CONTAINS 'storage' RETURN f.path"
```

---

### 9. `atlas search`

Performs ultra-fast full-text and symbol search using SQLite FTS5 with BM25 ranking.

```bash
# Search for symbols, functions, or files
atlas search "UserRepository"

# Limit result count
atlas search "authenticate" --limit 10
```

---

### 10. `atlas map`

Prints a clean ASCII visual tree of your codebase and its exported symbols directly in the terminal.

```bash
# Show map with default depth (3 levels)
atlas map

# Show deep map up to 5 directory levels
atlas map --depth 5
```

---

### 11. `atlas rules`

Manages AI prompt rules and system instructions across different platforms.

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

Auto-generates customized rule templates for AI editors:

```bash
# Generate for Google Antigravity (creates AGENTS.md)
atlas rules generate antigravity

# Generate for Claude (creates CLAUDE.md)
atlas rules generate claude

# Generate for Cursor (creates .cursorrules)
atlas rules generate cursor

# Generate for all supported platforms
atlas rules generate all

# Overwrite existing files
atlas rules generate all --force
```

**Supported Targets:** `antigravity`, `agents`, `claude`, `cursor`, `windsurf`, `copilot`, `cline`, `trae`, `roo`, `continue`, `deepseek`, `lingma`, `all`.

---

### 12. `atlas diff`

Analyzes your git working directory or branch diff and calculates the **Blast Radius**—showing which other files and modules are impacted by your changes.

```bash
# Analyze uncommitted working directory changes
atlas diff

# Compare against a specific base branch
atlas diff --base main
```

---

### 13. `atlas pr`

Generates a comprehensive Pull Request architectural summary suitable for AI Code Reviewers.

```bash
# Generate PR summary against main branch
atlas pr

# Compare against a custom branch
atlas pr --base develop
```

---

### 14. `atlas clean`

Cleans up the `.atlas/` directory to reclaim disk space.

```bash
# Clean database and caches
atlas clean

# Remove all snapshots
atlas clean --snapshots
```

---

### 15. `atlas mcp`

Starts the Model Context Protocol (MCP) server over `stdio` for real-time integration with AI assistants.

```bash
atlas mcp
```

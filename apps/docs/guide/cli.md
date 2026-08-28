# CLI Reference Manual

The `@codeatlas/cli` executable (`atlas`) provides command-line utilities for workspace indexing, context extraction, rule generation, and architecture visualization.

---

## Global Options

| Flag            | Description                           | Default         |
| --------------- | ------------------------------------- | --------------- |
| `-h, --help`    | Display help output for any command   | `false`         |
| `-v, --version` | Output the current version number     | `false`         |
| `--cwd <path>`  | Set explicit working directory        | `process.cwd()` |
| `--verbose`     | Output detailed debug and timing logs | `false`         |

---

## Commands

### `atlas index`

Traverses the workspace, executes Tree-sitter AST parsing on matching files, and commits metadata to `.atlas/atlas.db`.

```bash
# Index current workspace
atlas index

# Force re-indexing of all files bypassing hash cache
atlas index --force

# Index specific directory path
atlas index ./packages/storage
```

---

### `atlas rules`

Compiles and exports AI agent prompt rule specifications based on current repository state.

```bash
# Export to all supported AI platforms
atlas rules --all

# Export to a single platform
atlas rules --target cursor
atlas rules --target claude
atlas rules --target windsurf
atlas rules --target devin
atlas rules --target roo
```

---

### `atlas graph`

Starts an embedded HTTP server hosting the interactive 3D and 2D architecture visualizer.

```bash
# Launch server on default port (4200)
atlas graph

# Specify custom port
atlas graph --port 8080
```

---

### `atlas query`

Searches indexed symbols and dependencies directly from the terminal.

```bash
# Search for symbol declarations
atlas query "AuthService"

# Search with BM25 semantic relevance
atlas query "jwt token validation" --semantic
```

---

### `atlas context`

Generates a token-budgeted context pack formatted in Markdown for feeding into LLMs.

```bash
# Generate context pack with 4,000 token limit
atlas context --task "Add unit tests for storage repository" --budget 4000
```

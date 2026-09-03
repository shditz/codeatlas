# @codeatlas-ai/mcp

## 2.1.0

### Minor Changes

- Expanded tool catalog from 16 to 22 MCP tools (`atlas_search_symbols`, `atlas_get_god_components`, `atlas_get_dead_code`, `atlas_get_bottlenecks`, `atlas_calculate_change_surface`, `atlas_get_file_context`).
- Added JSONC safe parsing to preserve comments and user settings across Cursor, Claude Desktop, Antigravity, Cline, Roo Code, Continue, Windsurf, Zed, and VS Code.
- Added dynamic command resolver supporting NVM, FNM, Volta, ASDF, Homebrew, and local `node_modules`.
- Added pure stdio stream isolation by redirecting all internal logging to `stderr`.
- Added process lifecycle handlers (`rl.on('close')`, `SIGINT`, `SIGTERM`) to cleanly close SQLite databases.

### Patch Changes

- Updated all internal dependencies to `2.1.0`.

## 2.0.0

### Major Changes

- Model Context Protocol (MCP) server implementation with 16 tools and 1-click multi-agent configurator.

### Patch Changes

- Updated all internal dependencies to `2.0.0`.

## 0.4.0

### Minor Changes

- feat: smart init auto-detection, code health & dead code analytics, directory tree context packing, and advanced MCP tools.

### Patch Changes

- Updated dependencies
  - @codeatlas-ai/core@0.4.0
  - @codeatlas-ai/graph@0.4.0
  - @codeatlas-ai/parser@0.4.0
  - @codeatlas-ai/storage@0.4.0
  - @codeatlas-ai/analytics@0.4.0
  - @codeatlas-ai/context@0.4.0
  - @codeatlas-ai/indexer@0.4.0
  - @codeatlas-ai/retrieval@0.4.0
  - @codeatlas-ai/compression@0.4.0
  - @codeatlas-ai/exporters@0.4.0
  - @codeatlas-ai/git@0.4.0
  - @codeatlas-ai/llm@0.4.0
  - @codeatlas-ai/nl2cypher@0.4.0
  - @codeatlas-ai/ranking@0.4.0
  - @codeatlas-ai/rules@0.4.0
  - @codeatlas-ai/token-counter@0.4.0
  - @codeatlas-ai/shared@0.4.0

## 0.3.0

### Minor Changes

- feat: deep enhancements for existing commands (index, scan, diff, search, doctor) and MCP capabilities.

### Patch Changes

- Updated dependencies
  - @codeatlas-ai/core@0.3.0
  - @codeatlas-ai/graph@0.3.0
  - @codeatlas-ai/parser@0.3.0
  - @codeatlas-ai/storage@0.3.0
  - @codeatlas-ai/analytics@0.3.0
  - @codeatlas-ai/compression@0.3.0
  - @codeatlas-ai/context@0.3.0
  - @codeatlas-ai/exporters@0.3.0
  - @codeatlas-ai/git@0.3.0
  - @codeatlas-ai/indexer@0.3.0
  - @codeatlas-ai/llm@0.3.0
  - @codeatlas-ai/nl2cypher@0.3.0
  - @codeatlas-ai/ranking@0.3.0
  - @codeatlas-ai/retrieval@0.3.0
  - @codeatlas-ai/rules@0.3.0
  - @codeatlas-ai/token-counter@0.3.0
  - @codeatlas-ai/shared@0.3.0

## 0.2.0

### Minor Changes

- Comprehensive architecture analysis improvements, AST Tree-sitter fixes, Monorepo pnpm workspace discovery, and total documentation overhaul for AI agent integrations (Antigravity, Claude Code, Cursor).

### Patch Changes

- Updated dependencies
  - @codeatlas-ai/analytics@0.2.0
  - @codeatlas-ai/compression@0.2.0
  - @codeatlas-ai/context@0.2.0
  - @codeatlas-ai/core@0.2.0
  - @codeatlas-ai/exporters@0.2.0
  - @codeatlas-ai/git@0.2.0
  - @codeatlas-ai/graph@0.2.0
  - @codeatlas-ai/indexer@0.2.0
  - @codeatlas-ai/nl2cypher@0.2.0
  - @codeatlas-ai/parser@0.2.0
  - @codeatlas-ai/ranking@0.2.0
  - @codeatlas-ai/retrieval@0.2.0
  - @codeatlas-ai/rules@0.2.0
  - @codeatlas-ai/shared@0.2.0
  - @codeatlas-ai/storage@0.2.0
  - @codeatlas-ai/token-counter@0.2.0

## 0.1.1

### Patch Changes

- chore: patch bump for general refactoring and bugfixes
- Updated dependencies
  - @codeatlas-ai/analytics@0.1.1
  - @codeatlas-ai/compression@0.1.1
  - @codeatlas-ai/context@0.1.1
  - @codeatlas-ai/core@0.1.1
  - @codeatlas-ai/exporters@0.1.1
  - @codeatlas-ai/git@0.1.1
  - @codeatlas-ai/graph@0.1.1
  - @codeatlas-ai/indexer@0.1.1
  - @codeatlas-ai/nl2cypher@0.1.1
  - @codeatlas-ai/parser@0.1.1
  - @codeatlas-ai/ranking@0.1.1
  - @codeatlas-ai/retrieval@0.1.1
  - @codeatlas-ai/rules@0.1.1
  - @codeatlas-ai/shared@0.1.1
  - @codeatlas-ai/storage@0.1.1
  - @codeatlas-ai/token-counter@0.1.1

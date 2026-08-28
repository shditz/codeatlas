# @codeatlas/mcp-server

> Universal Model Context Protocol (MCP) Server for CodeAtlas — providing native AST indexing, dependency graph exploration, explainable context retrieval, and architecture rules to **all AI coding agents**.

---

## Supported AI Coding Agents

| AI Agent | Integration Protocol | Configuration File |
| :--- | :--- | :--- |
| **Claude Desktop** | MCP (stdio) | `claude_desktop_config.json` |
| **Claude Code (CLI)** | MCP (stdio) | `claude mcp add` |
| **Cursor** | MCP (stdio) | `.cursor/mcp.json` / Features Settings |
| **Windsurf (Codeium)** | MCP (stdio) | `~/.codeium/windsurf/mcp_config.json` |
| **Google Antigravity** | Native MCP / AGY CLI | `.gemini/config/mcp_config.json` |
| **Devin** | MCP Client | Project Settings |
| **OpenHands (OpenDevin)** | MCP Transport | `config.toml` |
| **Replit Agent** | CLI / MCP | Agent Tools |
| **Kimi Code / Moonshot** | Multi-LLM API & MCP | CodeAtlas API Bridge |
| **Grok / xAI Build** | Multi-LLM API & MCP | CodeAtlas API Bridge |
| **Vellum / OpenCode** | MCP Bridge | Workspace Config |

---

## Setup & Configuration

### 1. Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "codeatlas": {
      "command": "node",
      "args": ["C:/Users/DELL/Downloads/CodeAtlas/apps/mcp-server/dist/index.js"]
    }
  }
}
```

Or via global CLI:
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

### 2. Cursor (`.cursor/mcp.json` or Settings > Features > MCP)

Add new MCP Server:
- **Name**: `codeatlas`
- **Type**: `stdio`
- **Command**: `atlas mcp`

### 3. Windsurf (`~/.codeium/windsurf/mcp_config.json`)

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

### 4. Claude Code CLI

```bash
claude mcp add codeatlas atlas mcp
```

### 5. Antigravity 2.0 (`.gemini/config/mcp_config.json`)

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

## Exposed MCP Tools

- `atlas_scan`: Scans languages, frameworks, package managers, and workspaces.
- `atlas_index`: Rebuilds/updates AST symbols, dependencies, and full-text search index.
- `atlas_search`: Fast SQLite FTS5 BM25 search over files, functions, and symbols.
- `atlas_get_context`: Returns a token-budgeted, explainable code context bundle for any prompt.
- `atlas_graph_query`: Runs Cypher-like graph queries over the dependency graph.
- `atlas_pr_diff`: Generates a smart Pull Request diff with architectural impact analysis.
- `atlas_compress`: Compresses large source files into signature skeletons to conserve token limits.
- `atlas_get_map`: Returns hierarchical directory map with exported symbols.
- `atlas_get_rules`: Returns active coding rules and conflicts from AGENTS.md, CLAUDE.md, etc.
- `atlas_doctor`: Diagnostics on database status, indexed files, and symbol counts.

---

## Exposed MCP Resources

- `atlas://architecture/map`: Codebase architectural layout.
- `atlas://architecture/rules`: Discovered AI coding rules.
- `atlas://architecture/graph`: Topological dependency graph.

---

## Exposed MCP Prompt Templates

- `explain_codebase`: Step-by-step walkthrough of the repository architecture.
- `plan_feature`: Context-aware implementation plan for any proposed feature.
- `review_pr`: Senior architectural code review for current PR changes.

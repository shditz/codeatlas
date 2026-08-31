# @codeatlas-ai/mcp-server

> Universal Model Context Protocol (MCP) Server for CodeAtlas — providing native AST indexing, dependency graph exploration, explainable context retrieval, and architecture rules to **all AI coding agents**.

---

## Supported AI Coding Agents

| AI Agent                  | Integration Protocol | Configuration File                     |
| :------------------------ | :------------------- | :------------------------------------- |
| **Google Antigravity**    | Native MCP / AGY CLI | `.agents/mcp_config.json`              |
| **Claude Desktop**        | MCP (stdio)          | `claude_desktop_config.json`           |
| **Claude Code (CLI)**     | MCP (stdio)          | `claude mcp add`                       |
| **Cursor**                | MCP (stdio)          | `.cursor/mcp.json` / Features Settings |
| **Windsurf (Codeium)**    | MCP (stdio)          | `~/.codeium/windsurf/mcp_config.json`  |
| **Devin**                 | MCP Client           | Project Settings                       |
| **OpenHands (OpenDevin)** | MCP Transport        | `config.toml`                          |
| **Cline / Roo Code**      | MCP (stdio)          | Editor Settings                        |
| **Kimi Code / Moonshot**  | Multi-LLM API & MCP  | CodeAtlas API Bridge                   |
| **Grok / xAI Build**      | Multi-LLM API & MCP  | CodeAtlas API Bridge                   |

---

## Setup & Configuration

### 1. Google Antigravity (`.agents/mcp_config.json` or `~/.gemini/config/mcp_config.json`)

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

### 2. Claude Code CLI

```bash
claude mcp add codeatlas atlas -- mcp
```

### 3. Claude Desktop (`claude_desktop_config.json`)

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

### 4. Cursor (`.cursor/mcp.json` or Settings > Features > MCP)

```json
{
  "mcpServers": {
    "codeatlas": {
      "command": "atlas",
      "args": ["mcp"],
      "type": "stdio"
    }
  }
}
```

### 5. Windsurf (`~/.codeium/windsurf/mcp_config.json`)

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

## Exposed MCP Tools (16 Tools)

- `atlas_scan`: Scans languages, frameworks, package managers, and workspaces.
- `atlas_index`: Rebuilds/updates AST symbols, dependencies, and temporal git metrics (with secret redaction).
- `atlas_search`: Fast SQLite FTS5 BM25 search over files, functions, and symbols.
- `atlas_get_context`: Returns an intent-aware (`bug`/`feature`/`refactor`), token-budgeted context bundle.
- `atlas_graph_query`: Runs Cypher-like graph queries over the dependency graph.
- `atlas_pr_diff`: Generates a smart Pull Request diff with architectural impact analysis.
- `atlas_compress`: Compresses large source files into signature skeletons with automated secret redaction.
- `atlas_get_map`: Returns hierarchical directory map with exported symbols.
- `atlas_get_rules`: Returns active coding rules and conflicts from AGENTS.md, CLAUDE.md, etc.
- `atlas_doctor`: Diagnostics on database status, indexed files, and symbol counts.
- `atlas_analyze`: Deep architectural audit for DDD layer regressions, dead code, circular dependencies, and hotspots.
- `atlas_trace_execution_path`: Traces full call hierarchies upstream to entry points or downstream to leaf dependencies.
- `atlas_find_entry_points`: Discovers controllers, HTTP handlers, CLI commands, and root exported functions.
- `atlas_calculate_change_surface`: Computes downstream blast radius for proposed symbol modifications.
- `atlas_security_audit`: SAST security audit detecting injection vulnerabilities and leaked secrets.
- `atlas_plan_feature`: Autonomous feature planning tool generating step-by-step implementation blueprints.

---

## Exposed MCP Resources

- `atlas://architecture/map`: Codebase architectural layout and file list.
- `atlas://architecture/rules`: Discovered multi-agent coding guidelines.
- `atlas://architecture/graph`: Topological dependency graph and edge weights.

---

## Exposed MCP Prompt Templates

- `explain_codebase`: Step-by-step walkthrough of the repository architecture.
- `plan_feature`: Context-aware implementation plan for any proposed feature.
- `review_pr`: Senior architectural code review for current PR changes.

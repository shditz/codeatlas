# Model Context Protocol (MCP) Server

The `@codeatlas-ai/mcp` package implements an official Model Context Protocol (MCP) server, allowing external AI assistants (e.g., Claude Desktop, Cursor, Cline) to query codebase intelligence dynamically over standard stdio JSON-RPC.

---

## Available MCP Tools

### `get_repo_map`

Returns a compact, hierarchical map of the repository's directory structure and core entry points.

```json
{
  "name": "get_repo_map",
  "arguments": {
    "maxDepth": 3
  }
}
```

### `find_symbol`

Searches the AST symbol database for class, function, or interface definitions.

```json
{
  "name": "find_symbol",
  "arguments": {
    "query": "DatabaseClient",
    "kind": "class"
  }
}
```

### `get_dependencies`

Retrieves direct incoming and outgoing dependency edges for a specified file or module.

```json
{
  "name": "get_dependencies",
  "arguments": {
    "filePath": "src/services/auth.ts"
  }
}
```

### `get_context_pack`

Generates an optimized, token-budgeted context pack relevant to a natural language query or task description.

```json
{
  "name": "get_context_pack",
  "arguments": {
    "query": "Fix database transaction retry loop",
    "tokenBudget": 4000
  }
}
```

---

## Claude Desktop Configuration

To connect CodeAtlas to Claude Desktop, add the server to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codeatlas": {
      "command": "node",
      "args": ["/absolute/path/to/CodeAtlas/packages/mcp/dist/index.js"]
    }
  }
}
```

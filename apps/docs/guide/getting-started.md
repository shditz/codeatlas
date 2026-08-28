# Getting Started

This guide walks you through installing CodeAtlas, configuring your workspace, indexing your repository, and utilizing AI rule generators and interactive visualizers.

---

## Installation

CodeAtlas provides a global Command-Line Interface (`@codeatlas-ai/cli`) and an official Visual Studio Code extension.

### Method 1: Building & Installing from Source (Recommended)

```bash
# Clone and link CLI globally
git clone https://github.com/shditz/codeatlas.git
cd codeatlas
pnpm install
pnpm build
pnpm --filter @codeatlas-ai/cli link --global
```

Verify your installation:

```bash
atlas --version
```

_(Note: Direct installation via `npm install -g @codeatlas-ai/cli` will also be available once published to the public npm registry)._

### Method 2: VS Code Extension

1. Download the `.vsix` bundle from the [Releases](https://github.com/shditz/codeatlas/releases) page.
2. In VS Code, navigate to the **Extensions** tab (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Click the menu (`...`) in the top-right corner of the Extensions panel.
4. Select **Install from VSIX...** and select the downloaded file.

---

## Quick-Start Workflow

### Step 1: Initialize Workspace Index

Run `atlas index` in your repository root directory:

```bash
cd /path/to/my-codebase
atlas index
```

CodeAtlas performs the following actions:

- Traverses the directory tree, honoring `.gitignore` and `.atlasignore`.
- Discovers supported source files (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.php`, `.rs`, `.go`, `.html`, `.css`).
- Parses AST structures in parallel via Tree-sitter workers.
- Records symbols, line metrics, SHA-256 hashes, and import bindings in `.atlas/atlas.db`.

```
[INFO] Discovered 152 source files.
[INFO] Parsing AST structures... Done in 240ms.
[INFO] Extracted 418 symbols and 382 dependency links.
[SUCCESS] Workspace indexed into .atlas/atlas.db
```

---

### Step 2: Generate AI Agent Rules

Synchronize context and prompt instructions across all configured AI editors:

```bash
# Export rule sets to all supported platforms
atlas rules --all
```

To target a specific editor:

```bash
# Export specifically for Cursor (.cursorrules)
atlas rules --target cursor

# Export specifically for Windsurf (.windsurfrules)
atlas rules --target windsurf

# Export specifically for Claude Desktop / Claude Code (CLAUDE.md)
atlas rules --target claude
```

---

### Step 3: Launch the Interactive Architecture Graph

Launch the local interactive visualizer in your web browser:

```bash
atlas graph --port 4200
```

Alternatively, if using the VS Code extension:

- Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
- Select **`CodeAtlas: Open Interactive Graph`**.
- Inspect modules in 3D or 2D, filter by file type, and click nodes to jump directly into your source code.

---

## Configuration Reference (`codeatlas.config.json`)

To customize indexing parameters, create an optional `codeatlas.config.json` file in your repository root:

```json
{
  "$schema": "https://raw.githubusercontent.com/shditz/codeatlas/main/schema.json",
  "include": ["src/**/*", "packages/**/*", "apps/**/*"],
  "exclude": ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/vendor/**", "**/coverage/**"],
  "maxFileSizeKB": 2048,
  "rules": {
    "autoExportOnIndex": true,
    "defaultTargets": ["cursor", "claude", "devin"]
  },
  "graph": {
    "defaultDimension": "3D",
    "autoRotate": true
  }
}
```

---

## Next Steps

- Explore [System Architecture](/guide/architecture)
- Learn about the [AST Parser Pipeline](/guide/parser)
- View the complete [CLI Reference](/guide/cli)

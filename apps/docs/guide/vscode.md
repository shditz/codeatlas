# VS Code Extension Manual

The official **CodeAtlas VS Code Extension** integrates AST indexing, symbol navigation, AI rule synchronization, and interactive architecture visualization into Visual Studio Code.

---

## Key Features

### 1. Interactive Architecture Graph

- **3D and 2D Layouts**: Switch between WebGL 3D spatial force layout and 2D Canvas planar view.
- **Spotlight Mode**: Highlights active dependency paths while dimming unrelated files for focused module tracing.
- **Search & Filters**: Search by file name or path, with instant filter chips for Files and Folders.
- **Node Inspector**: Inspect file size, language, connected dependencies, and jump directly to source files via the "Open in Editor" button.

### 2. Automatic Background Indexing

- Monitors file save events in your workspace.
- Executes incremental Tree-sitter AST diffing in the background, updating `.atlas/codeatlas.db` without blocking editor performance.

---

## Command Palette Actions

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command Identifier          | Title                               | Description                                          |
| --------------------------- | ----------------------------------- | ---------------------------------------------------- |
| `codeatlas.openGraphView`   | `CodeAtlas: Open Interactive Graph` | Opens the 2D/3D architecture graph visualizer tab    |
| `codeatlas.indexWorkspace`  | `CodeAtlas: Index Workspace`        | Triggers a full workspace AST re-indexing            |
| `codeatlas.exportRules`     | `CodeAtlas: Export AI Rules`        | Generates prompt rule files for Cursor, Claude, etc. |
| `codeatlas.showContextPack` | `CodeAtlas: Show Context Budget`    | Displays token usage and compressed symbol metrics   |

---

## Editor Title Bar Integration

When viewing any source file in your editor, CodeAtlas adds a dedicated **Graph View** button to the top-right editor title bar. Clicking this icon immediately opens the interactive architecture map centered on the current file.

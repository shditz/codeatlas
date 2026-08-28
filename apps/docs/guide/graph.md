# Dependency Graph Visualizer

The `@codeatlas-ai/graph` and `@codeatlas-ai/webview` packages provide visual exploration and topological analysis of workspace files, folders, and code dependencies.

---

## Graph Data Model

CodeAtlas models codebase relationships as a directed graph:

- **Directory containment (`contains`)**: Represents hierarchical file-folder ownership.
- **Direct code imports (`import`, `require`)**: Extracted from AST import statements across TypeScript, JavaScript, Python, PHP, Go, and Rust.
- **Module dependencies (`calls`, `extends`)**: Cross-module invocations and interface implementations.

```text
[Directory: /src]
   └── contains ──> [Directory: /src/auth]
                        └── contains ──> [File: auth.ts]
                                             └── import ──> [File: /src/db/client.ts]
```

### Node Schema

- `id`: Workspace relative path.
- `name`: File or folder name.
- `type`: `file` or `dir`.
- `language`: Detected source language (e.g. `typescript`, `python`, `php`).
- `val`: Visual node size proportional to file size and symbol count.
- `color`: Distinct color coding categorized by file extension/language.

---

## Visualizer Capabilities

### 1. 3D Force-Directed Mode

- WebGL rendering using `three` and `react-force-graph-3d`.
- Force-directed spatial layout with configurable repulsion physics to prevent node overlap.
- Smooth camera orbit controls with auto-rotation toggle.
- Animated particle streams along active dependency links.

### 2. 2D Planar Mode

- High-performance 2D Canvas rendering using `react-force-graph-2d`.
- Automatic text labels rendered as readable tags on zoom.
- Sibling cluster linking: maintains directory groupings when filtering to file-only views.

### 3. Spotlight & Path Isolation

- Hovering or selecting any node highlights its direct dependency path at full opacity while dimming unrelated modules.
- Allows engineers to trace multi-hop import chains without visual clutter.

### 4. Search & Category Filters

- Real-time search bar to filter by file path or symbol name.
- Category buttons (`All`, `Files`, `Folders`) to quickly inspect directory structures or file topologies.

### 5. Node Inspector & VS Code Bridge

- Clicking a node displays a slide-in drawer showing file metadata, size, language, and connected neighbour count.
- **"Open in Editor"** button sends an IPC message to VS Code to reveal and open the file immediately.

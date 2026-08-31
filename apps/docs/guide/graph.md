# Dependency Graph & Topological Engine

The `@codeatlas-ai/graph` and `@codeatlas-ai/webview` packages provide high-performance in-memory graph algorithms, Cypher query execution, and visual exploration of workspace dependencies.

---

## Graph Data Model

CodeAtlas models codebase relationships as an attributed, directed property graph:

- **Directory Containment (`contains`)**: Represents hierarchical file-folder ownership.
- **Direct Code Imports (`import`, `require`)**: Extracted from AST import statements across TypeScript, JavaScript, Python, PHP, Go, Rust, and Prisma.
- **Semantic Type Inheritance (`type_reference`)**: Derived classes (`extends`) and interface implementations (`implements`).
- **Framework Relations**: NestJS provider injection and Prisma database model relations.

```text
[Directory: /src]
   └── contains ──> [Directory: /src/auth]
                        └── contains ──> [File: auth.service.ts]
                                             ├── import ──> [File: /src/db/client.ts]
                                             └── extends ──> [File: /src/common/base.service.ts]
```

### Edge Attributes

Every dependency edge in CodeAtlas contains:

- `source_path`: Originating source file.
- `target_path`: Resolved destination file.
- `kind`: `import`, `require`, `export_from`, `type_reference`, `call`.
- `symbols`: List of imported or referenced symbol names.
- `weight`: Edge strength metric based on import frequency.
- `confidence`: Resolution confidence score (`1.0` for deterministic AST/tsconfig resolution, `0.7` for heuristic fallbacks).
- `resolution_reason`: Explanatory metadata (e.g. `'tsconfig_paths'`, `'relative_import'`, `'type_inheritance'`).

---

## In-Memory Graph Algorithms

1. **Topological Sort & Cycle Detection**:
   - Tarjan's strongly connected components algorithm identifies circular import loops and outputs actionable Mermaid diagrams.
2. **Blast Radius & Downstream Reachability**:
   - Calculates transitive closure to show all modules impacted by editing a specific file or symbol (`atlas diff`, `atlas_calculate_change_surface`).
3. **Graph Centrality & PageRank**:
   - Calculates module importance to prioritize core domain abstractions during context retrieval.
4. **Cypher & NL2Cypher Query Engine**:
   - Executes Cypher graph queries (e.g. `MATCH (f:File)-[:IMPORTS]->(t:File) ...`) against the in-memory graph.

---

## Visualizer Capabilities (2D & 3D Webview)

1. **3D Force-Directed Mode**: WebGL rendering via Three.js with orbit controls, particle streams, and force physics.
2. **2D Planar Mode**: High-performance HTML5 Canvas rendering with automatic text LOD tagging.
3. **Spotlight & Path Isolation**: Highlighting connected dependencies while dimming unrelated nodes.
4. **VS Code & IDE Bridge**: Clicking a node directly opens the source file in your active editor window.

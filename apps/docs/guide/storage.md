# Storage & Database Schema

The `@codeatlas/storage` package manages the embedded SQLite database located at `.atlas/codeatlas.db` within each indexed workspace.

---

## Entity Relational Diagram

```mermaid
erDiagram
    PROJECTS ||--o{ FILES : contains
    PROJECTS ||--o{ RULES : configures
    FILES ||--o{ SYMBOLS : declares
    FILES ||--o{ DEPENDENCIES : links

    PROJECTS {
        int id PK
        string name
        string rootPath
        int createdAt
        int updatedAt
    }

    FILES {
        int id PK
        int projectId FK
        string relativePath
        string language
        int size
        int lineCount
        string hash
    }

    SYMBOLS {
        int id PK
        int fileId FK
        string name
        string kind
        int startLine
        int endLine
        string signature
    }

    DEPENDENCIES {
        int id PK
        int projectId FK
        string source
        string target
        string kind
    }
```

---

## Performance Characteristics

- **WAL Mode Enabled**: Writes operate via Write-Ahead Logging (`PRAGMA journal_mode = WAL`), enabling concurrent non-blocking reads.
- **Synchronous Normal**: Optimized disk sync behavior (`PRAGMA synchronous = NORMAL`) for maximum indexing throughput.
- **Indexed Queries**: Composite B-tree indexes on `(projectId, relativePath)` and `(source, target)` ensure sub-millisecond graph query resolution.

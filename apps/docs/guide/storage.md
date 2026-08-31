# Storage & Database Schema

The `@codeatlas-ai/storage` package manages the embedded SQLite database located at `.atlas/atlas.db` within each indexed workspace using Node 22 native `node:sqlite`.

---

## Entity Relational Diagram

```mermaid
erDiagram
    PROJECTS ||--o{ FILES : contains
    PROJECTS ||--o{ RULES : configures
    PROJECTS ||--o{ EMBEDDINGS : indexes
    FILES ||--o{ SYMBOLS : declares
    FILES ||--o{ DEPENDENCIES : links
    FILES ||--o| GIT_METRICS : tracks

    PROJECTS {
        int id PK
        string name
        string root
        string package_manager
        int is_monorepo
        string languages
        string frameworks
        string workspaces
    }

    FILES {
        int id PK
        int project_id FK
        string path
        string relative_path
        string language
        int size
        string hash
        int is_test
        int symbol_count
    }

    SYMBOLS {
        int id PK
        int file_id FK
        string name
        string kind
        int line
        int end_line
        int column_num
        int exported
        string signature
        string parent_symbol
        int cyclomatic_complexity
    }

    DEPENDENCIES {
        int id PK
        int project_id FK
        string source_path
        string target_path
        string kind
        string symbols
        real weight
        real confidence
        string resolution_reason
    }

    GIT_METRICS {
        int file_id PK_FK
        int commit_count
        int last_modified
        real churn_score
    }

    EMBEDDINGS {
        int id PK
        int project_id FK
        string file_path
        string symbol_name
        string embedding
        int dimensions
        string model
    }
```

---

## 🔄 Automatic Schema Migrations

CodeAtlas executes automated, transactional migrations on startup:

1. **Migration 1 (`initial_schema`)**: Core `projects`, `files`, `symbols`, `dependencies`, `rules` tables, and `files_fts` / `symbols_fts` SQLite FTS5 search virtual tables.
2. **Migration 2 (`embeddings_table`)**: Vector embedding table for hybrid vector search.
3. **Migration 3 (`add_cyclomatic_complexity`)**: Adds `cyclomatic_complexity` calculation to `symbols`.
4. **Migration 4 (`add_dependency_confidence_and_resolution`)**: Adds `confidence` (0.0–1.0) and `resolution_reason` to `dependencies` for tracking semantic resolution.
5. **Migration 5 (`create_git_metrics_table`)**: Creates `git_metrics` table for temporal Git churn and change frequency tracking.

---

## ⚡ Performance Characteristics

- **WAL Mode Enabled**: Writes operate via Write-Ahead Logging (`PRAGMA journal_mode = WAL`), enabling concurrent non-blocking reads.
- **Synchronous Normal**: Optimized disk sync behavior (`PRAGMA synchronous = NORMAL`) for maximum indexing throughput.
- **Full-Text FTS5**: Tokenized with `porter unicode61` for sub-millisecond keyword and symbol searches.
- **Automated Secret Redaction**: Secrets are sanitized _before_ entering SQLite FTS tables.

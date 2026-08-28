# Universal AI Agent Rules Exporter

The `@codeatlas-ai/rules` package automates the generation and synchronization of AI prompt guidelines and architectural context across all major AI coding platforms.

---

## Target Matrix

| Platform                         | Target Output     | Format                | Primary Use Case                              |
| -------------------------------- | ----------------- | --------------------- | --------------------------------------------- |
| **Cursor**                       | `.cursorrules`    | Plain Text / Markdown | Editor-level project guidelines & patterns    |
| **Windsurf / Cascade**           | `.windsurfrules`  | Markdown              | Assistant memories and project constraints    |
| **Claude Desktop / Claude Code** | `CLAUDE.md`       | Markdown              | CLI and desktop agent context guidelines      |
| **Devin**                        | `DEVIN.md`        | Markdown              | Autonomous agent instructions and setup rules |
| **Roo Code**                     | `.roorules`       | Markdown              | Role-based prompting for Roo Code extension   |
| **Aider**                        | `.aider.atlas.md` | Markdown              | Repository maps and architectural summaries   |
| **Antigravity / OpenHands**      | `AGENTS.md`       | Markdown              | Cross-agent repository operating instructions |

---

## Execution Commands

### Full Export

```bash
atlas rules --all
```

### Targeted Export

```bash
# Export specifically for Cursor
atlas rules --target cursor

# Export specifically for Windsurf
atlas rules --target windsurf

# Export specifically for Claude
atlas rules --target claude
```

---

## Structure of Generated Rule Files

Each generated rule file includes structured sections derived from the project's real AST and package configuration:

1. **Repository Summary**: Primary languages, package manager, build scripts, test runners.
2. **Architecture Map**: High-level directory breakdown and primary entry points.
3. **Coding & Typing Standards**: TypeScript strictness, naming conventions, import ordering.
4. **Key Symbols & Contracts**: Core interfaces, services, and domain models extracted from the database.
5. **Decoupling Constraints**: Package dependency rules to prevent boundary violations.

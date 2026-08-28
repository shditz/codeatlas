# 📜 AI Rules & Guideline Generator

CodeAtlas automatically inspects your repository's tech stack (languages, frameworks, monorepos, and package managers) and compiles custom prompt guideline files for all major AI coding platforms.

---

## 🎯 Supported Target Platforms

| Target            | Output File                       | Compatible Tools                     |
| :---------------- | :-------------------------------- | :----------------------------------- |
| **`antigravity`** | `AGENTS.md`                       | Google Antigravity, OpenHands, Devin |
| **`claude`**      | `CLAUDE.md`                       | Claude Code CLI, Claude Desktop      |
| **`cursor`**      | `.cursorrules`                    | Cursor Editor                        |
| **`windsurf`**    | `.windsurfrules`                  | Windsurf IDE / Cascade               |
| **`copilot`**     | `.github/copilot-instructions.md` | GitHub Copilot                       |
| **`cline`**       | `.clinerules`                     | Cline Extension                      |
| **`roo`**         | `.roorules`                       | Roo Code Extension                   |
| **`trae`**        | `.traerules`                      | Trae IDE                             |
| **`continue`**    | `.continue/rules.md`              | Continue.dev                         |
| **`deepseek`**    | `DEEPSEEK.md`                     | DeepSeek Coder Agents                |
| **`lingma`**      | `.lingmarules`                    | Alibaba Cloud Tongyi Lingma          |

---

## 💻 Commands

### Generate for All Platforms

Generates the core set of guideline files (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`):

```bash
atlas rules generate all
```

### Generate for a Specific Target

```bash
# Generate specifically for Antigravity
atlas rules generate antigravity

# Generate specifically for Claude
atlas rules generate claude

# Generate specifically for Cursor
atlas rules generate cursor
```

### Overwriting Existing Files

If rule files already exist and you want to refresh them based on your latest codebase scan, pass `--force`:

```bash
atlas rules generate all --force
```

---

## 🔍 Managing & Validating Rules

### List Active Rules

Shows all discovered rule files, their scope (global or path-specific), and priority:

```bash
atlas rules list
```

### Validate & Detect Conflicts

Analyzes your rule files to find conflicting instructions (e.g. one rule telling AI to use tabs while another specifies spaces):

```bash
atlas rules validate
```

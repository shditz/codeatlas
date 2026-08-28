# ⚙️ Configuration Reference (`.atlas/config.toml`)

CodeAtlas configuration is stored in clean **TOML** format inside `.atlas/config.toml`. It is automatically created when you run `atlas init`.

---

## 📄 Complete Example Configuration

```toml
[project]
name = "MyAwesomeProject"

[index]
follow_symlinks = false
include_tests = true
max_file_size = 1048576 # 1 MB maximum per file

[ranking]
lexical_weight = 0.25
symbol_weight = 0.20
path_weight = 0.15
dependency_weight = 0.15
rule_weight = 0.10
recency_weight = 0.10
module_weight = 0.05

[context]
max_tokens = 12000
default_mode = "full" # Options: "full", "signature", "summary", "digest"

[security]
scan_secrets = true
exclude_patterns = [".env", "*.pem", "*.key", "id_rsa*"]

[ai]
provider = "none" # Options: "openai", "anthropic", "gemini", "ollama", "none"
model = "gpt-4o"
```

---

## 🛠️ Configuration Sections

### `[project]`

- **`name`** _(string)_: Project name (defaults to repository folder name).

### `[index]`

- **`follow_symlinks`** _(boolean, default: `false`)_: Whether to follow symbolic links during file traversal.
- **`include_tests`** _(boolean, default: `true`)_: Whether to parse test files (`*.test.ts`, `*.spec.ts`, etc.).
- **`max_file_size`** _(number, default: `1048576`)_: Maximum file size in bytes to index. Files larger than this (e.g. huge minified bundles) will be skipped safely.

### `[context]`

- **`max_tokens`** _(number, default: `12000`)_: Default token budget when packing context for LLMs.
- **`default_mode`** _(string, default: `"full"`)_: Default compression level:
  - `"full"`: Complete file contents.
  - `"signature"`: AST skeletons containing only class, function, and interface signatures (saves up to 80% tokens).
  - `"summary"`: High-level overview of files and symbols.
  - `"digest"`: Ultra-compact token summary.

### `[security]`

- **`scan_secrets`** _(boolean, default: `true`)_: Detects potential API keys or secrets before exporting context.
- **`exclude_patterns`** _(array of strings)_: Glob patterns of sensitive files to never include in context packs.

---

## 🚫 Ignoring Files (`.atlasignore`)

You can also create a `.atlasignore` file in your repository root to ignore specific paths (using standard `.gitignore` syntax):

```gitignore
# Ignore build outputs and temporary files
dist/
build/
coverage/
*.min.js
legacy-scripts/
```

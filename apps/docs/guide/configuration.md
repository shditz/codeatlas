# Configuration Reference

Configure CodeAtlas indexing, rule exporting, and graph visualizer settings via `codeatlas.config.json` placed in your repository root.

---

## Schema Overview

```json
{
  "$schema": "https://raw.githubusercontent.com/shditz/codeatlas/main/schema.json",
  "include": ["src/**/*", "packages/**/*", "apps/**/*"],
  "exclude": ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/vendor/**", "**/coverage/**"],
  "maxFileSizeKB": 2048,
  "rules": {
    "autoExportOnIndex": true,
    "defaultTargets": ["cursor", "claude", "devin", "windsurf"],
    "includeArchitectureMap": true,
    "includeTypingStandards": true
  },
  "graph": {
    "defaultDimension": "3D",
    "autoRotate": true,
    "particleSpeed": 0.005
  }
}
```

---

## Property Specifications

### `include`

- **Type**: `string[]`
- **Default**: `["**/*"]`
- Glob patterns specifying files and directories to parse during index operations.

### `exclude`

- **Type**: `string[]`
- **Default**: `["**/node_modules/**", "**/dist/**", "**/.git/**"]`
- Glob patterns specifying paths to ignore during traversal.

### `maxFileSizeKB`

- **Type**: `number`
- **Default**: `1024`
- Upper limit for individual source file sizes to prevent out-of-memory errors on minified bundles.

### `rules.autoExportOnIndex`

- **Type**: `boolean`
- **Default**: `false`
- When set to `true`, `atlas index` will automatically recompile and export all rule files.

### `rules.defaultTargets`

- **Type**: `string[]`
- List of default target formats to generate when executing `atlas rules`. Supported values: `cursor`, `windsurf`, `claude`, `devin`, `roo`, `aider`, `agents`.

# Agent Workflow Best Practices

Integrating CodeAtlas into CI/CD pipelines and agentic development workflows maximizes context accuracy and minimizes hallucination.

---

## 1. Automated Pre-Commit Rule Synchronization

Ensure your `.cursorrules`, `CLAUDE.md`, and other AI rule files are kept up to date automatically on every commit:

```bash
# Add to package.json scripts
{
  "scripts": {
    "prepare": "atlas index && atlas rules --all"
  }
}
```

Or using Git Hooks (`.husky/pre-commit`):

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

atlas index
atlas rules --all
git add .cursorrules CLAUDE.md .windsurfrules DEVIN.md
```

---

## 2. GitHub Actions Integration

Use the official CodeAtlas GitHub Action (`@codeatlas-ai/github-action`) to validate PR architectural constraints and generate context digests for AI reviewers:

```yaml
name: CodeAtlas Architecture Check

on:
  pull_request:
    branches: [main]

jobs:
  verify-architecture:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: pnpm install
      - run: pnpm exec atlas index
      - run: pnpm exec atlas rules --all --check
```

---

## 3. Pairing with Autonomous Coding Agents

When working with autonomous agents (Devin, OpenHands, Antigravity, SWE-agent):

1. **Pre-Seed Context**: Provide the agent with the output of `atlas context --task "Description"` to focus its attention on relevant files.
2. **Boundary Protection**: Configure rule decoupling guidelines in `codeatlas.config.json` so the agent respects package boundaries.

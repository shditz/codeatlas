# Contributing to CodeAtlas

Thank you for contributing to CodeAtlas! This document provides guidelines and workflows for contributing to the project.

---

## Development Environment Setup

### Prerequisites

- **Node.js**: `>= 22.0.0`
- **pnpm**: `>= 9.0.0`
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/shditz/codeatlas.git
cd codeatlas

# Install workspace dependencies
pnpm install

# Build all packages and applications
pnpm build

# Run Vitest test suite
pnpm test
```

---

## Monorepo Layout

CodeAtlas is organized as a pnpm workspace:

- `packages/core`: Core domain models and canonical interfaces.
- `packages/parser`: Multi-language Tree-sitter AST extraction pipeline.
- `packages/storage`: SQLite database and repository abstraction layer.
- `packages/graph`: In-memory graph algorithms and topological sorting.
- `packages/rules`: Universal AI prompt rules exporter.
- `packages/compression`: Context token optimization and symbol digests.
- `packages/retrieval`: BM25 lexical ranking and multi-signal search.
- `packages/mcp`: Standard Model Context Protocol (MCP) server.
- `apps/cli`: Standalone binary executable (`atlas`).
- `apps/vscode-extension`: Visual Studio Code extension.
- `apps/webview`: ForceGraph2D/3D React webview application.
- `apps/docs`: VitePress documentation site.

---

## Development Workflow

1. Create a feature branch: `git checkout -b feat/your-feature-name`
2. Implement your changes adhering to TypeScript strict mode.
3. Validate code quality and tests:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   ```
4. Commit your changes using the [Conventional Commits](https://www.conventionalcommits.org/) specification:
   - `feat(parser): add support for Elixir grammar`
   - `fix(webview): resolve camera jitter in 3D orbit mode`
   - `docs(guide): add MCP integration manual`
5. Open a Pull Request on GitHub against the `main` branch.

---

## Code Quality Standards

- **Strict Typing**: No implicit `any`. Use discriminated unions and strictly typed domain models from `@codeatlas/core`.
- **Local-First Privacy**: Never introduce network calls or analytics that transmit user code or metadata externally.
- **Decoupled Packages**: Packages must communicate strictly through `@codeatlas/core` abstractions.
- **High Test Coverage**: Maintain passing unit tests with Vitest across all modules.

---

## License

By contributing to CodeAtlas, you agree that your contributions will be licensed under the [MIT License](LICENSE).

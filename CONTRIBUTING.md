# Contributing to CodeAtlas

Contributions are welcome. This guide covers the development environment, repository workflows, testing expectations, and pull request process for CodeAtlas.

---

## Before You Start

- **Bug Fixes & Small Improvements:** Feel free to open a Pull Request directly.
- **Large Features & Architectural Changes:** Open an issue first to discuss the proposed design before investing significant time writing code.
- **Security Vulnerabilities:** Do not report security issues through public GitHub issues. Follow the instructions in [SECURITY.md](SECURITY.md).

---

## Development Environment Setup

### Prerequisites

- **Node.js**: `>= 20.0.0`
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

# Run unit and integration test suite (166 tests)
pnpm test
```

---

## Common Development Commands

```bash
# Build all packages in topological order
pnpm build

# Run test suite across all packages
pnpm test

# Typecheck all TypeScript packages
pnpm typecheck

# Run linter and code formatter
pnpm lint
pnpm format

# Target a specific package or application
pnpm --filter @codeatlas-ai/parser test
pnpm --filter @codeatlas-ai/storage test
pnpm --filter @codeatlas-ai/mcp test

# Run documentation portal locally
pnpm --filter @codeatlas-ai/docs docs:dev
```

---

## Testing Strategy

CodeAtlas uses [Vitest](https://vitest.dev/) for unit and integration testing. When contributing code:

- **Parser Changes (`packages/parser`):** Add fixture test files or AST assertions in `packages/parser/src/__tests__/` to verify syntax node extraction and edge cases.
- **Graph & Analytics (`packages/graph`, `packages/analytics`):** Include deterministic graph assertions verifying cycle detection, centrality scores, or layer boundaries.
- **Storage & Migrations (`packages/storage`):** Test schema queries against temporary in-memory or SQLite fixture databases.
- **MCP Server (`packages/mcp`):** Verify JSON-RPC tool schemas, input validations, and execution handler responses.

All tests must pass locally with `pnpm test` before submitting a PR.

---

## Code Standards & Architectural Boundaries

1. **Strict Typing:** Write strict TypeScript without implicit `any`. Use discriminated unions and shared types from `@codeatlas-ai/core`.
2. **Public Interfaces:** Packages must import from public entry points (`src/index.ts`) of other packages rather than reaching into private internals.
3. **Local-First Privacy:** Never introduce unsolicited telemetry, background analytics, or network transmissions of repository code.
4. **Error Handling:** Use typed `Result<T, E>` patterns or domain errors (`@codeatlas-ai/shared`) instead of throwing generic unhandled exceptions.

_For full package relationships and forbidden dependency rules, see [ARCHITECTURE.md](ARCHITECTURE.md)._

---

## Branching & Commit Conventions

### Branch Naming

Use descriptive branch prefixes:

- `feat/*` — New features or parser adapters (e.g. `feat/elixir-parser`)
- `fix/*` — Bug fixes and regression repairs (e.g. `fix/sqlite-reindex-constraint`)
- `docs/*` — Documentation additions or updates (e.g. `docs/mcp-guide`)
- `refactor/*` — Internal code refactoring without behavior change
- `perf/*` — Performance optimizations

### Commit Messages

We generally follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(parser): add Dart mixin and async method extraction
fix(storage): resolve FTS5 deletion constraint failure on re-indexing
docs(vscode): update marketplace installation instructions
```

---

## Pull Request Process

### Pull Request Guidelines

- Keep pull requests focused on a single logical change.
- Include unit or integration tests for new functionality and bug fixes.
- Update relevant documentation in `README.md` or `apps/docs/` when user-facing behavior changes.
- Avoid committing generated files or local databases.

### Pull Request Checklist

Before submitting your PR, ensure the following checklist is satisfied:

- [ ] `pnpm typecheck` passes with zero errors.
- [ ] `pnpm lint` passes with zero warnings or errors.
- [ ] `pnpm test` passes 100% across all suites.
- [ ] Tests were added or updated for modified behavior.
- [ ] Documentation was updated if introducing new commands, options, or tools.
- [ ] No generated files (`.atlas/`, `dist/`, `.vsix`, `coverage/`) are included in the commit.

---

## Issue Guidelines

When opening a bug report or feature request:

1. **Check Existing Issues:** Search open and closed issues first to avoid duplicates.
2. **Provide Reproduction Steps:** Include minimal reproduction code, operating system, and Node.js version.
3. **Redact Sensitive Data:** Never paste private source code, proprietary tokens, or environment credentials into public issue descriptions.

---

## Generated Files & Exclusions

Do not commit generated or machine-specific files to version control:

- Local database directories: `.atlas/`
- Build artifacts: `dist/`, `build/`, `*.vsix`
- Dependencies and coverage: `node_modules/`, `coverage/`, `.turbo/`

---

## AI-Assisted Contributions

Contributions created with the help of AI coding tools (such as Google Antigravity, Claude Code, Cursor, Copilot) are welcome. However, contributors are personally responsible for thoroughly understanding, testing, and verifying all submitted code. Pull requests containing unverified or non-functional AI-generated boilerplate will be closed.

---

## License

By contributing to CodeAtlas, you agree that your contributions will be licensed under the [MIT License](LICENSE).

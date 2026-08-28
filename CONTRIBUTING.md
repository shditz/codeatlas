# Contributing to CodeAtlas

Thank you for your interest in contributing to CodeAtlas!

## Development Setup

1. **Prerequisites**: Node.js ≥20, pnpm ≥9
2. Clone the repository
3. Run `pnpm install`
4. Run `pnpm build` to verify the build works

## Project Structure

This is a pnpm monorepo with packages in `packages/` and apps in `apps/`.

## Making Changes

1. Create a feature branch from `main`
2. Make your changes
3. Run `pnpm typecheck`, `pnpm lint`, and `pnpm test`
4. Submit a pull request

## Code Style

- TypeScript strict mode
- Prettier for formatting
- ESLint for linting
- Explicit types at boundaries
- Avoid `any` — use `unknown` when the type is truly unknown

## Testing

We use Vitest. Run tests with `pnpm test`.

Tests should validate meaningful behavior, not just check that functions exist.

## Commit Messages

Use conventional commit format:

```
feat(parser): add Python language support
fix(indexer): handle symlinks on Windows
docs: update CLI reference
```

## Questions?

Open an issue for discussion.

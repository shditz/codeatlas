# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do not open a public issue for security vulnerabilities.**

Instead, email the maintainers directly or use GitHub's private vulnerability reporting feature.

## Security Design

CodeAtlas is designed as a local-first tool:

- **No source code is uploaded** to external servers by default
- **Secret detection** filters potential credentials from context packs
- **`.atlasignore`** provides fine-grained exclusion control
- **No telemetry** — zero analytics or tracking by default
- **LLM providers are optional** — the core system works without external API calls

## Scope

This policy applies to the CodeAtlas codebase and its default behavior. Third-party LLM providers configured by the user are governed by their own security policies.

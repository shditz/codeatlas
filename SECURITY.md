# Security Policy

This document outlines our vulnerability reporting process and our foundational security principles.

---

## Reporting a Vulnerability

If you discover a security vulnerability in CodeAtlas, please report it responsibly:

- **Do NOT open a public GitHub issue.**
- Report security issues privately via GitHub's [Private Vulnerability Reporting](https://github.com/shditz/codeatlas/security/advisories/new) or by emailing the maintainers directly.
- Please provide detailed steps to reproduce the issue, including affected versions, operating system, and proof-of-concept code where applicable.
- We aim to acknowledge receipt of vulnerability reports within 48 hours and provide remediation updates regularly.

---

## Core Security & Privacy Principles

CodeAtlas is built to keep your code private and secure on your local machine:

1. **Local-First Architecture**: All AST parsing, SQLite storage, and context generation execute 100% locally on your machine.
2. **Deterministic Exclusions**: CodeAtlas automatically respects `.gitignore` and `.atlasignore` to prevent parsing of sensitive credentials, environment files (`.env`), private keys, or certificate bundles.
3. **Secret Masking**: Automated heuristics filter known secret patterns (e.g., API tokens, AWS keys, JWT tokens) from generated context and exported files.
4. **No Telemetry**: CodeAtlas contains zero telemetry, analytics, tracking pings, or remote logging.
5. **Sandboxed Webview**: The VS Code Extension Webview operates within a sandboxed context, enforcing strict Content Security Policies (CSP) and local resource root boundaries.

---

## Supported Versions

| Version   | Supported |
| --------- | --------- |
| `0.1.x`   | Yes       |
| `< 0.1.0` | No        |

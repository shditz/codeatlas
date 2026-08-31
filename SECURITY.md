# Security Policy

This document outlines our vulnerability reporting process, foundational security principles, and the automated secret redaction architecture implemented in CodeAtlas.

---

## Reporting a Vulnerability

If you discover a security vulnerability in CodeAtlas, please report it responsibly:

- **Do NOT open a public GitHub issue.**
- Report security issues privately via GitHub's [Private Vulnerability Reporting](https://github.com/shditz/codeatlas/security/advisories/new) or by contacting the maintainers directly.
- Please provide detailed steps to reproduce the issue, including affected versions, operating system, and proof-of-concept code where applicable.
- We aim to acknowledge receipt of vulnerability reports within 48 hours and provide remediation updates regularly.

---

## Core Security & Privacy Principles

CodeAtlas is built to keep your code private and secure on your local machine:

1. **Local-First Architecture**: All AST parsing, SQLite storage, and context generation execute 100% locally on your machine. Your code never leaves your workstation.
2. **Automated Secret Redaction Layer (`SecretScanner`)**:
   - Integrated directly into the Ingestion and MCP Egress pipelines.
   - High-entropy regular expression filters automatically detect and scrub:
     - **Private Keys**: RSA, EC, DSA, OpenSSH, PGP private key blocks $\rightarrow$ `[REDACTED_PRIVATE_KEY]`.
     - **Cloud & SaaS API Keys**: Anthropic (`sk-ant-`), OpenAI (`sk-`), Google Cloud (`AIza...`), GitHub (`ghp_`, `gho_`, `github_pat_`), AWS (`AKIA...`), Slack (`xoxb-`, `xoxp-`), Stripe (`sk_live_`, `rk_live_`).
     - **JWT Tokens**: Bearer JWT tokens $\rightarrow$ `[REDACTED_JWT_TOKEN]`.
     - **Database Credentials**: Connection URIs (PostgreSQL, MySQL, MongoDB, Redis) $\rightarrow$ `postgres://user:[REDACTED_PASSWORD]@host/db`.
     - **Configuration Secrets**: Sensitive key assignments in `.env` and config files $\rightarrow$ `[REDACTED_SECRET]`.
   - Redacted _in-memory_ before hashing and inserting into SQLite search databases (`files_fts`).
3. **Deterministic Ignore Filters**: CodeAtlas automatically respects `.gitignore` and `.atlasignore` to bypass build artifacts, cache directories, and key bundles.
4. **Zero Telemetry**: CodeAtlas contains zero telemetry, tracking pings, third-party analytics, or remote error logging.
5. **Sandboxed Webview**: The VS Code Extension Webview operates within a sandboxed context, enforcing strict Content Security Policies (CSP) and local resource root boundaries.

---

## Supported Versions

| Version   | Supported |
| :-------- | :-------- |
| `1.0.x`   | Yes       |
| `0.4.x`   | Yes       |
| `0.3.x`   | Yes       |
| `0.2.x`   | Yes       |
| `< 0.2.0` | No        |

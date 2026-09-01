# Security Policy

This document outlines the security model, vulnerability reporting process, data privacy principles, and secret handling mechanisms in CodeAtlas.

---

## Reporting a Vulnerability

If you discover a security vulnerability in CodeAtlas, please report it responsibly:

- **Do NOT open a public GitHub issue.**
- Submit reports privately through [GitHub Private Vulnerability Reporting](https://github.com/shditz/codeatlas/security/advisories/new).
- Provide detailed reproduction steps, including affected package versions, operating system, and a minimal proof-of-concept where applicable.

### Response Lifecycle

- **Initial Acknowledgement:** Within 48 hours of receipt.
- **Initial Triage & Assessment:** Within 5 business days.
- **Remediation & Disclosure:** Coordinated with the reporter before public advisory release.

---

## Scope

### In Scope

- CodeAtlas CLI (`@codeatlas-ai/cli`)
- Core packages (`@codeatlas-ai/*`)
- Official VS Code / Cursor extension (`codeatlas-official`)
- Model Context Protocol (MCP) server implementations

### Out of Scope

- Vulnerabilities in third-party dependencies, unless directly exploitable through CodeAtlas's implementation.
- Vulnerabilities requiring direct physical or local root access to an unlocked developer workstation.
- Security boundaries of external AI assistants or IDE host platforms.

---

## Security Model & Data Flow

CodeAtlas is designed as a **local-first developer tool**:

```
Source Files (Disk)
       │
       ▼
In-Memory Secret Redaction (SecretScanner)
       │
       ▼
AST Parsing (Tree-sitter) & Semantic Resolution
       │
       ▼
Local SQLite Database (.atlas/atlas.db)
       │
       ├── Local CLI Commands (`atlas`)
       ├── Local IDE Extension (VS Code / Cursor)
       └── Model Context Protocol (MCP over stdio)
```

1. **Local Execution by Default:** Indexing, AST parsing, dependency graph calculation, and context retrieval execute locally on your workstation. CodeAtlas does not intentionally transmit source code or indexed graph data to external remote servers.
2. **Database Sensitivity:** The generated SQLite database (`.atlas/atlas.db`) contains structural metadata, symbol signatures, dependency graphs, and indexed search tokens of your codebase. **Treat `.atlas/atlas.db` as sensitive project data.** It should never be committed to public version control repositories.
3. **Trust Boundaries:** CodeAtlas treats repository source files, user configurations, and external MCP tool inputs as untrusted inputs. File operations and path traversals are constrained to the active workspace root.

---

## Secret Detection & Redaction

CodeAtlas includes an in-memory `SecretScanner` that scrubs common credential formats before data is indexed into SQLite or passed through MCP tools:

- **Private Keys:** RSA, EC, DSA, OpenSSH, and PGP private key blocks (`[REDACTED_PRIVATE_KEY]`).
- **Cloud & SaaS Credentials:** Known pattern formats for AWS, Google Cloud, GitHub tokens, OpenAI, Anthropic, Slack, and Stripe keys (`[REDACTED_SECRET]`).
- **Database Connection URIs:** PostgreSQL, MySQL, MongoDB, and Redis connection strings containing passwords.
- **Authentication Tokens:** Bearer JWT headers and signatures (`[REDACTED_JWT_TOKEN]`).

### Important Limitations & Disclaimer

> Pattern-based secret scanning is a **defense-in-depth measure**, not a substitute for proper secrets management.
> Heuristic and regex-based detectors may yield false positives or fail to detect proprietary, obfuscated, or newly introduced token formats. Users must not rely on CodeAtlas as a sole security boundary for credential protection.

---

## Data Privacy & Telemetry

- **No First-Party Telemetry:** CodeAtlas does not include first-party telemetry, user tracking pings, usage analytics, or remote crash reporting.
- **Network Boundaries:** The core CLI and MCP server operate strictly over standard I/O (`stdio`) or local processes. External network requests are only initiated when explicitly requested by user commands (such as dependency version lookups or package installations).

---

## Extension & Webview Security

The official VS Code / Cursor extension operates under the following safeguards:

- **Isolated Webview Context:** The 2D/3D visualizer runs inside an isolated webview with strict Content Security Policy (CSP) headers.
- **Resource Boundaries:** Access is restricted to designated local extension directories via `localResourceRoots`. External web resources and inline script evaluation from untrusted sources are disabled.
- **Message Verification:** Inter-process communication between the webview and extension backend validates message payloads before executing graph or file actions.

---

## Ignore Rules & Indexing Scope

CodeAtlas respects `.gitignore` and `.atlasignore` to exclude build outputs, temporary artifacts, and cache directories from the indexing pipeline.

> **Note:** Ignore rules configure indexing scope for performance and noise reduction; they do not constitute a cryptographic or sandbox security boundary.

---

## Vulnerability Severity Classification

| Severity     | Description                                                                                                                          | Examples                                                     |
| :----------- | :----------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| **Critical** | Remote code execution, arbitrary command injection via malicious repository configurations, or unauthenticated privilege escalation. | Remote code execution via unsanitized workspace paths.       |
| **High**     | Arbitrary filesystem read/write outside the designated workspace root, or complete bypass of secret redaction.                       | Path traversal allowing reads outside repository boundaries. |
| **Moderate** | Information disclosure of local metadata, unexpected cross-project dependency resolution leaks.                                      | Unsanitized error messages exposing system paths.            |
| **Low**      | Non-exploitable security hardening improvements, denial of service on malformed local syntax files.                                  | Infinite loop on cyclic symlinks during indexing.            |

---

## Supported Versions

| Release Line               | Status      | Security Support                  |
| :------------------------- | :---------- | :-------------------------------- |
| **`2.x` (Current Stable)** | Active      | Full security updates and patches |
| **`1.x` (Previous Major)** | Maintenance | Critical security fixes only      |
| **`< 1.0.0`**              | End of Life | Unsupported                       |

---

## Security Best Practices for Users

1. **Keep `.atlas/` in `.gitignore`:** Ensure `.atlas/` is added to your project's `.gitignore` to prevent local graph databases from being committed to public repositories (`atlas init` configures this automatically).
2. **Exclude Sensitive Folders:** If your repository contains folders with mock credentials, test certificates, or sensitive fixtures, explicitly list them in `.atlasignore`.
3. **Environment Security:** Store sensitive API keys in dedicated environment secret managers rather than plain text repository files.
4. **Stay Updated:** Regularly update CodeAtlas to the latest release to receive the latest security patches and parser hardening updates.

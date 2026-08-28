import fs from 'node:fs';
import path from 'node:path';
import type { FileInfo } from '@codeatlas-ai/core';
import { createLogger } from '@codeatlas-ai/shared';

const logger = createLogger('analytics:taint');

export type VulnerabilityType =
  'SQL_INJECTION' | 'COMMAND_INJECTION' | 'CODE_INJECTION' | 'PATH_TRAVERSAL' | 'XSS';

export type VulnerabilitySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface TaintVulnerability {
  id: string;
  type: VulnerabilityType;
  severity: VulnerabilitySeverity;
  filePath: string;
  line: number;
  sinkText: string;
  sourceText: string;
  variable: string;
  description: string;
  remediation: string;
}

export interface SecurityAuditReport {
  scannedFiles: number;
  vulnerabilities: TaintVulnerability[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

export interface TaintAnalyzerOptions {
  rootDir?: string;
  files?: FileInfo[];
  minSeverity?: VulnerabilitySeverity;
}

export class TaintAnalyzer {
  private rootDir: string;
  private files: FileInfo[];

  constructor(options: TaintAnalyzerOptions = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.files = options.files || [];
  }

  public audit(fileList?: FileInfo[]): SecurityAuditReport {
    const targets = fileList || this.files;
    const vulnerabilities: TaintVulnerability[] = [];
    let scannedFiles = 0;

    for (const file of targets) {
      const fullPath = path.isAbsolute(file.path) ? file.path : path.join(this.rootDir, file.path);
      if (!fs.existsSync(fullPath)) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        scannedFiles++;
        const fileVulns = this.analyzeFileContent(file.relativePath, content);
        vulnerabilities.push(...fileVulns);
      } catch (err) {
        logger.debug(`Could not read ${file.relativePath} for taint analysis:`, err);
      }
    }

    const summary = {
      critical: vulnerabilities.filter((v) => v.severity === 'CRITICAL').length,
      high: vulnerabilities.filter((v) => v.severity === 'HIGH').length,
      medium: vulnerabilities.filter((v) => v.severity === 'MEDIUM').length,
      low: vulnerabilities.filter((v) => v.severity === 'LOW').length,
      total: vulnerabilities.length,
    };

    return {
      scannedFiles,
      vulnerabilities,
      summary,
    };
  }

  public analyzeFileContent(filePath: string, content: string): TaintVulnerability[] {
    const results: TaintVulnerability[] = [];
    const lines = content.split('\n');

    // Track tainted variables in this file: variableName -> { line, sourceExpr }
    const taintedVars = new Map<string, { line: number; source: string }>();

    // 1. Identify Sources (User Inputs & Ingress data)
    const sourcePatterns = [
      /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:req\.(?:query|body|params|headers)(?:\.[A-Za-z0-9_$]+|\[[^\]]+\])?)/,
      /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*process\.argv/,
      /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:prompt\(|readline|stdin)/,
      /(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*req\.(?:query|body|params|headers)/,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNum = i + 1;

      for (const pattern of sourcePatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          if (match[1].includes(',')) {
            // Destructured variables
            match[1].split(',').forEach((v) => {
              const cleanVar = v.trim().split(':')[0]?.trim();
              if (cleanVar) {
                taintedVars.set(cleanVar, { line: lineNum, source: line.trim() });
              }
            });
          } else {
            taintedVars.set(match[1].trim(), { line: lineNum, source: line.trim() });
          }
        }
      }
    }

    // 2. Identify Sinks (Dangerous Execution Call Sites)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const lineNum = i + 1;

      // Pattern A: SQL Injection (String template / concatenation in SQL execution)
      const sqlSinkMatch =
        line.match(/(?:query|execute|raw|db\.run|db\.all|db\.exec)\s*\(\s*`[^`]*\$\{([^}]+)\}/) ||
        line.match(
          /(?:query|execute|raw|db\.run|db\.all)\s*\(\s*["'][^"']*\s*\+\s*([A-Za-z0-9_$]+)/,
        );

      if (sqlSinkMatch && sqlSinkMatch[1]) {
        const expr = sqlSinkMatch[1].trim();
        const isTainted =
          taintedVars.has(expr) ||
          expr.includes('req.') ||
          expr.includes('input') ||
          expr.includes('query');

        if (isTainted) {
          const src = taintedVars.get(expr);
          results.push({
            id: `SQLI-${filePath}-${lineNum}`,
            type: 'SQL_INJECTION',
            severity: 'CRITICAL',
            filePath,
            line: lineNum,
            sinkText: line.trim(),
            sourceText: src?.source || line.trim(),
            variable: expr,
            description: `Potential SQL Injection: Variable '${expr}' is interpolated directly into a database query.`,
            remediation:
              'Use parameterized queries (e.g. `db.run(sql, ?)` or prepared statements) instead of string interpolation.',
          });
        }
      }

      // Pattern B: Command Injection (Unsanitized exec/spawn)
      const cmdSinkMatch =
        line.match(/(?:exec|execSync|spawn|spawnSync)\s*\(\s*`[^`]*\$\{([^}]+)\}/) ||
        line.match(/(?:exec|execSync)\s*\(\s*["'][^"']*\s*\+\s*([A-Za-z0-9_$]+)/);

      if (cmdSinkMatch && cmdSinkMatch[1]) {
        const expr = cmdSinkMatch[1].trim();
        const isTainted =
          taintedVars.has(expr) ||
          expr.includes('req.') ||
          expr.includes('cmd') ||
          expr.includes('input');

        if (isTainted) {
          const src = taintedVars.get(expr);
          results.push({
            id: `CMDI-${filePath}-${lineNum}`,
            type: 'COMMAND_INJECTION',
            severity: 'CRITICAL',
            filePath,
            line: lineNum,
            sinkText: line.trim(),
            sourceText: src?.source || line.trim(),
            variable: expr,
            description: `Command Injection: Untrusted variable '${expr}' is passed directly to system shell execution.`,
            remediation:
              'Use `execFileSync` or `spawn` with an arguments array rather than executing concatenated shell strings.',
          });
        }
      }

      // Pattern C: Code Injection (eval / new Function)
      const evalSinkMatch = line.match(/\b(?:eval|new\s+Function)\s*\(\s*([A-Za-z0-9_$]+|`[^`]*`)/);
      if (evalSinkMatch && evalSinkMatch[1]) {
        const expr = evalSinkMatch[1].trim();
        if (!line.includes('// ignore-eval')) {
          results.push({
            id: `EVAL-${filePath}-${lineNum}`,
            type: 'CODE_INJECTION',
            severity: 'HIGH',
            filePath,
            line: lineNum,
            sinkText: line.trim(),
            sourceText: line.trim(),
            variable: expr,
            description: `Dynamic Code Evaluation: Using eval() or Function constructor with variable '${expr}'.`,
            remediation:
              'Avoid dynamic eval(). Use structured JSON parsers or static dispatch tables.',
          });
        }
      }

      // Pattern D: Path Traversal
      const hasFsRead = /(?:readFile|readFileSync|createReadStream|createWriteStream)\s*\(/.test(
        line,
      );
      if (hasFsRead) {
        for (const [taintedVar, src] of taintedVars.entries()) {
          if (line.includes(taintedVar)) {
            results.push({
              id: `TRAV-${filePath}-${lineNum}`,
              type: 'PATH_TRAVERSAL',
              severity: 'HIGH',
              filePath,
              line: lineNum,
              sinkText: line.trim(),
              sourceText: src.source,
              variable: taintedVar,
              description: `Path Traversal Risk: File system read/write uses untrusted variable '${taintedVar}' without path validation.`,
              remediation:
                'Validate input against an allowlist and verify resolved path starts with expected root directory.',
            });
            break;
          }
        }
      }

      // Pattern E: Cross-Site Scripting (XSS in frontend)
      const xssSinkMatch = line.match(
        /(?:innerHTML\s*=\s*|dangerouslySetInnerHTML\s*=\s*\{\s*__html:\s*)([A-Za-z0-9_$]+)/,
      );
      if (xssSinkMatch && xssSinkMatch[1]) {
        const expr = xssSinkMatch[1].trim();
        results.push({
          id: `XSS-${filePath}-${lineNum}`,
          type: 'XSS',
          severity: 'MEDIUM',
          filePath,
          line: lineNum,
          sinkText: line.trim(),
          sourceText: line.trim(),
          variable: expr,
          description: `Cross-Site Scripting (XSS): Direct injection of raw HTML into DOM via variable '${expr}'.`,
          remediation:
            'Sanitize HTML input using DOMPurify or use textContent / standard React JSX bindings.',
        });
      }
    }

    return results;
  }
}

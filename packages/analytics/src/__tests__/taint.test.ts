import { describe, it, expect } from 'vitest';
import { TaintAnalyzer } from '../taint-analyzer.js';

describe('TaintAnalyzer (SAST & Data-Flow Analysis)', () => {
  it('detects SQL injection vulnerabilities from user input', () => {
    const code = `
      import express from 'express';
      const app = express();

      app.get('/users', async (req, res) => {
        const userId = req.query.id;
        const result = await db.query(\`SELECT * FROM users WHERE id = '\${userId}'\`);
        res.json(result);
      });
    `;

    const analyzer = new TaintAnalyzer();
    const vulns = analyzer.analyzeFileContent('src/routes/users.ts', code);

    expect(vulns.length).toBeGreaterThan(0);
    const sqli = vulns.find((v) => v.type === 'SQL_INJECTION');
    expect(sqli).toBeDefined();
    expect(sqli?.severity).toBe('CRITICAL');
    expect(sqli?.variable).toBe('userId');
    expect(sqli?.line).toBe(7);
  });

  it('detects Command injection vulnerabilities from request parameters', () => {
    const code = `
      import { exec } from 'node:child_process';

      export function handlePing(req, res) {
        const host = req.body.host;
        exec(\`ping -c 4 \${host}\`, (err, stdout) => {
          res.send(stdout);
        });
      }
    `;

    const analyzer = new TaintAnalyzer();
    const vulns = analyzer.analyzeFileContent('src/controllers/ping.ts', code);

    const cmdi = vulns.find((v) => v.type === 'COMMAND_INJECTION');
    expect(cmdi).toBeDefined();
    expect(cmdi?.severity).toBe('CRITICAL');
    expect(cmdi?.variable).toBe('host');
  });

  it('detects dynamic eval / code injection', () => {
    const code = `
      export function executePluginScript(userScript) {
        const result = eval(userScript);
        return result;
      }
    `;

    const analyzer = new TaintAnalyzer();
    const vulns = analyzer.analyzeFileContent('src/plugins/runner.ts', code);

    const evalVuln = vulns.find((v) => v.type === 'CODE_INJECTION');
    expect(evalVuln).toBeDefined();
    expect(evalVuln?.severity).toBe('HIGH');
  });

  it('detects Path Traversal vulnerabilities', () => {
    const code = `
      import fs from 'node:fs';
      import path from 'node:path';

      export function serveUserFile(req, res) {
        const filename = req.params.filename;
        const fileData = fs.readFileSync(path.join('/uploads', filename), 'utf-8');
        res.send(fileData);
      }
    `;

    const analyzer = new TaintAnalyzer();
    const vulns = analyzer.analyzeFileContent('src/controllers/files.ts', code);

    const trav = vulns.find((v) => v.type === 'PATH_TRAVERSAL');
    expect(trav).toBeDefined();
    expect(trav?.severity).toBe('HIGH');
  });

  it('detects Cross-Site Scripting (XSS) in DOM manipulation', () => {
    const code = `
      export function renderUserProfile(userHtml) {
        document.getElementById('profile').innerHTML = userHtml;
      }
    `;

    const analyzer = new TaintAnalyzer();
    const vulns = analyzer.analyzeFileContent('src/client/profile.ts', code);

    const xss = vulns.find((v) => v.type === 'XSS');
    expect(xss).toBeDefined();
    expect(xss?.severity).toBe('MEDIUM');
  });

  it('returns clean report on secure, parameterized code', () => {
    const code = `
      import { db } from './db.js';

      export async function getUser(id: number) {
        return db.all('SELECT * FROM users WHERE id = ?', id);
      }
    `;

    const analyzer = new TaintAnalyzer();
    const vulns = analyzer.analyzeFileContent('src/services/user.ts', code);

    expect(vulns).toHaveLength(0);
  });
});

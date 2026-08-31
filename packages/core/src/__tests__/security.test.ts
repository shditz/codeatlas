import { describe, it, expect } from 'vitest';
import { SecretScanner, redactSecrets } from '../security.js';

describe('Security Redaction Layer (SecretScanner)', () => {
  const scanner = new SecretScanner();

  it('detects and redacts OpenAI and generic sk- API keys', () => {
    const code = 'const apiKey = "sk-1234567890abcdef1234567890abcdef";';
    const redacted = redactSecrets(code);
    expect(redacted).not.toContain('sk-1234567890abcdef1234567890abcdef');
    expect(redacted).toContain('[REDACTED_API_KEY]');
  });

  it('detects and redacts Anthropic API keys', () => {
    const code = 'const anthropicKey = "sk-ant-api03-abcdef12345678901234567890";';
    const redacted = redactSecrets(code);
    expect(redacted).not.toContain('sk-ant-api03-abcdef12345678901234567890');
    expect(redacted).toContain('[REDACTED_ANTHROPIC_KEY]');
  });

  it('detects and redacts GitHub Personal Access Tokens and Fine-Grained Tokens', () => {
    const code = 'const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";';
    const redacted = redactSecrets(code);
    expect(redacted).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
    expect(redacted).toContain('[REDACTED_GITHUB_TOKEN]');
  });

  it('detects and redacts AWS Access Keys', () => {
    const code = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
    const redacted = redactSecrets(code);
    expect(redacted).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(redacted).toContain('[REDACTED_AWS_KEY]');
  });

  it('detects and redacts Google API Keys', () => {
    const code = 'const gKey = "AIzaSyD-1234567890abcdefghijklmnopqrst";';
    const redacted = redactSecrets(code);
    expect(redacted).not.toContain('AIzaSyD-1234567890abcdefghijklmnopqrst');
    expect(redacted).toContain('[REDACTED_GOOGLE_API_KEY]');
  });

  it('detects and redacts JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const code = `const token = "${jwt}";`;
    const redacted = redactSecrets(code);
    expect(redacted).not.toContain(jwt);
    expect(redacted).toContain('[REDACTED_JWT_TOKEN]');
  });

  it('detects and redacts Private Key blocks', () => {
    const pkey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y3L8+0X9r4x0/samplekeydatahere
-----END RSA PRIVATE KEY-----`;
    const code = `const key = \`${pkey}\`;`;
    const redacted = redactSecrets(code);
    expect(redacted).not.toContain('samplekeydatahere');
    expect(redacted).toContain('[REDACTED_PRIVATE_KEY]');
  });

  it('detects and redacts database connection strings with passwords', () => {
    const uri = 'postgres://admin:super_secret_password_123@localhost:5432/mydb';
    const redacted = redactSecrets(uri);
    expect(redacted).not.toContain('super_secret_password_123');
    expect(redacted).toContain('postgres://admin:[REDACTED_PASSWORD]@localhost:5432/mydb');
  });

  it('detects and redacts config/env secret assignments', () => {
    const env = `
DATABASE_URL=postgres://localhost/db
SECRET_KEY=my_super_secret_session_token_12345
API_KEY="production_api_token_abc_xyz"
PASSWORD=myVerySecurePassword123
`;
    const redacted = redactSecrets(env);
    expect(redacted).not.toContain('my_super_secret_session_token_12345');
    expect(redacted).not.toContain('production_api_token_abc_xyz');
    expect(redacted).not.toContain('myVerySecurePassword123');
    expect(redacted).toContain('SECRET_KEY=[REDACTED_SECRET]');
    expect(redacted).toContain('API_KEY="[REDACTED_SECRET]"');
    expect(redacted).toContain('PASSWORD=[REDACTED_SECRET]');
  });

  it('scans and returns exact line/column locations of detected secrets', () => {
    const code = `// line 1
const token = "sk-1234567890abcdef1234567890abcdef";
const next = true;`;
    const findings = scanner.scan(code);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    const finding = findings.find((f) => f.type.includes('API Key'));
    expect(finding).toBeDefined();
    expect(finding?.line).toBe(2);
  });
});

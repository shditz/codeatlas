export interface DetectedSecret {
  type: string;
  match: string;
  redacted: string;
  line: number;
  column: number;
}

export interface SecretRedactionOptions {
  maskFormat?: string;
  customPatterns?: Array<{ name: string; regex: RegExp; placeholder: string }>;
}

export interface SecretPattern {
  name: string;
  regex: RegExp;
  placeholder: string;
}

export const DEFAULT_SECRET_PATTERNS: SecretPattern[] = [
  {
    name: 'Private Key',
    regex:
      /-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9_-]+ )?PRIVATE KEY-----/g,
    placeholder: '[REDACTED_PRIVATE_KEY]',
  },
  {
    name: 'Anthropic API Key',
    regex: /\bsk-ant-[a-zA-Z0-9_-]{20,}\b/g,
    placeholder: '[REDACTED_ANTHROPIC_KEY]',
  },
  {
    name: 'OpenAI/Generic API Key',
    regex: /\bsk-[a-zA-Z0-9_-]{20,}\b/g,
    placeholder: '[REDACTED_API_KEY]',
  },
  {
    name: 'GitHub Token',
    regex: /\b(?:ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b/g,
    placeholder: '[REDACTED_GITHUB_TOKEN]',
  },
  {
    name: 'AWS Access Key',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    placeholder: '[REDACTED_AWS_KEY]',
  },
  {
    name: 'Google API Key',
    regex: /\bAIza[0-9A-Za-z_-]{30,45}\b/g,
    placeholder: '[REDACTED_GOOGLE_API_KEY]',
  },
  {
    name: 'Slack Token',
    regex: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/g,
    placeholder: '[REDACTED_SLACK_TOKEN]',
  },
  {
    name: 'Stripe API Key',
    regex: /\b(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{24,99}\b/g,
    placeholder: '[REDACTED_STRIPE_KEY]',
  },
  {
    name: 'JSON Web Token (JWT)',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    placeholder: '[REDACTED_JWT_TOKEN]',
  },
  {
    name: 'Database Connection String with Password',
    regex:
      /((?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis|amqp):\/\/[^:\s]+:)([^@\s]+)(@)/gi,
    placeholder: '$1[REDACTED_PASSWORD]$3',
  },
  {
    name: 'Config Secret Assignment',
    regex:
      /((?:api[_-]?key|secret[_-]?key|secret|password|passwd|auth[_-]?token|access[_-]?token|client[_-]?secret|private[_-]?key)\s*[:=]\s*["']?)(?!(?:\[REDACTED_))([^"'\r\n\s]{8,})(["']?)/gi,
    placeholder: '$1[REDACTED_SECRET]$3',
  },
];

export class SecretScanner {
  private patterns: SecretPattern[];

  constructor(options?: SecretRedactionOptions) {
    this.patterns = [...DEFAULT_SECRET_PATTERNS];
    if (options?.customPatterns) {
      this.patterns.push(...options.customPatterns);
    }
  }

  scan(content: string): DetectedSecret[] {
    const findings: DetectedSecret[] = [];
    const lines = content.split('\n');

    for (const pattern of this.patterns) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.regex.exec(content)) !== null) {
        const matchedText = match[0];
        const matchIndex = match.index;

        let line = 1;
        let column = 1;
        let charCount = 0;

        for (let i = 0; i < lines.length; i++) {
          const lineLength = lines[i]!.length + 1;
          if (charCount + lineLength > matchIndex) {
            line = i + 1;
            column = matchIndex - charCount + 1;
            break;
          }
          charCount += lineLength;
        }

        findings.push({
          type: pattern.name,
          match: matchedText,
          redacted: pattern.placeholder,
          line,
          column,
        });

        if (match.index === pattern.regex.lastIndex) {
          pattern.regex.lastIndex++;
        }
      }
    }

    return findings;
  }

  redact(content: string): string {
    if (!content) return content;
    let sanitized = content;

    for (const pattern of this.patterns) {
      pattern.regex.lastIndex = 0;
      sanitized = sanitized.replace(pattern.regex, pattern.placeholder);
    }

    return sanitized;
  }
}

const defaultScanner = new SecretScanner();

export function redactSecrets(content: string, options?: SecretRedactionOptions): string {
  if (!options) {
    return defaultScanner.redact(content);
  }
  const scanner = new SecretScanner(options);
  return scanner.redact(content);
}

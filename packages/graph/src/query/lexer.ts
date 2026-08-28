import type { Token, TokenType } from './types.js';

const KEYWORDS = new Set([
  'MATCH',
  'WHERE',
  'RETURN',
  'AND',
  'OR',
  'NOT',
  'CONTAINS',
  'STARTS_WITH',
  'ENDS_WITH',
  'TRUE',
  'FALSE',
]);

export class Lexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(input: string) {
    this.input = input.trim();
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const char = this.input[this.pos]!;

      // Arrow or dash patterns
      if (this.input.startsWith('->', this.pos)) {
        tokens.push(this.makeToken('ARROW_RIGHT', '->', 2));
        continue;
      }
      if (this.input.startsWith('<-', this.pos)) {
        tokens.push(this.makeToken('ARROW_LEFT', '<-', 2));
        continue;
      }
      if (char === '-') {
        tokens.push(this.makeToken('DASH', '-', 1));
        continue;
      }

      // Comparison operators
      if (
        this.input.startsWith('!=', this.pos) ||
        this.input.startsWith('>=', this.pos) ||
        this.input.startsWith('<=', this.pos)
      ) {
        const op = this.input.substring(this.pos, this.pos + 2);
        tokens.push(this.makeToken('OPERATOR', op, 2));
        continue;
      }
      if (char === '=' || char === '>' || char === '<') {
        tokens.push(this.makeToken('OPERATOR', char, 1));
        continue;
      }

      // Single character delimiters
      if (char === ':') {
        tokens.push(this.makeToken('COLON', ':', 1));
        continue;
      }
      if (char === ',') {
        tokens.push(this.makeToken('COMMA', ',', 1));
        continue;
      }
      if (char === '(') {
        tokens.push(this.makeToken('LPAREN', '(', 1));
        continue;
      }
      if (char === ')') {
        tokens.push(this.makeToken('RPAREN', ')', 1));
        continue;
      }
      if (char === '[') {
        tokens.push(this.makeToken('LBRACKET', '[', 1));
        continue;
      }
      if (char === ']') {
        tokens.push(this.makeToken('RBRACKET', ']', 1));
        continue;
      }
      if (char === '{') {
        tokens.push(this.makeToken('LBRACE', '{', 1));
        continue;
      }
      if (char === '}') {
        tokens.push(this.makeToken('RBRACE', '}', 1));
        continue;
      }

      // String literals (single or double quote)
      if (char === '"' || char === "'") {
        tokens.push(this.readString(char));
        continue;
      }

      // Numbers
      if (/\d/.test(char)) {
        tokens.push(this.readNumber());
        continue;
      }

      // Identifiers or Keywords
      if (/[a-zA-Z_]/.test(char)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      // Unknown character fallback
      this.advance();
    }

    tokens.push({
      type: 'EOF',
      value: '',
      line: this.line,
      column: this.column,
    });

    return tokens;
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
      } else if (char === '\n') {
        this.line++;
        this.column = 1;
        this.pos++;
      } else {
        break;
      }
    }
  }

  private makeToken(type: TokenType, value: string, length: number): Token {
    const token: Token = {
      type,
      value,
      line: this.line,
      column: this.column,
    };
    for (let i = 0; i < length; i++) {
      this.advance();
    }
    return token;
  }

  private readString(quote: string): Token {
    const startCol = this.column;
    const startLine = this.line;
    this.advance(); // skip quote
    let value = '';

    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      if (this.input[this.pos] === '\\' && this.pos + 1 < this.input.length) {
        this.advance();
        value += this.input[this.pos];
      } else {
        value += this.input[this.pos];
      }
      this.advance();
    }

    if (this.pos < this.input.length && this.input[this.pos] === quote) {
      this.advance(); // skip closing quote
    }

    return {
      type: 'STRING',
      value,
      line: startLine,
      column: startCol,
    };
  }

  private readNumber(): Token {
    const startCol = this.column;
    let numStr = '';

    while (this.pos < this.input.length && /[\d.]/.test(this.input[this.pos]!)) {
      numStr += this.input[this.pos];
      this.advance();
    }

    return {
      type: 'NUMBER',
      value: numStr,
      line: this.line,
      column: startCol,
    };
  }

  private readIdentifier(): Token {
    const startCol = this.column;
    let ident = '';

    while (this.pos < this.input.length && /[a-zA-Z0-9_.]/.test(this.input[this.pos]!)) {
      ident += this.input[this.pos];
      this.advance();
    }

    const upper = ident.toUpperCase();
    const type: TokenType = KEYWORDS.has(upper) ? 'KEYWORD' : 'IDENTIFIER';

    return {
      type,
      value: KEYWORDS.has(upper) ? upper : ident,
      line: this.line,
      column: startCol,
    };
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }
}

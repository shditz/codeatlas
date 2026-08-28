import { Lexer } from './lexer.js';
import type {
  Token,
  GraphQuery,
  NodePattern,
  EdgePattern,
  WhereClause,
  ComparisonOperator,
} from './types.js';

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(queryStr: string) {
    const lexer = new Lexer(queryStr);
    this.tokens = lexer.tokenize();
  }

  parse(): GraphQuery {
    this.expectKeyword('MATCH');

    const source = this.parseNodePattern();
    let edge: EdgePattern | undefined;
    let target: NodePattern | undefined;

    // Check if there is an edge pattern: -[...] -> or -> or -
    if (this.check('DASH') || this.check('ARROW_LEFT')) {
      edge = this.parseEdgePattern();
      target = this.parseNodePattern();
    }

    const whereClauses: WhereClause[] = [];
    if (this.matchKeyword('WHERE')) {
      do {
        whereClauses.push(this.parseWhereClause());
      } while (this.matchKeyword('AND'));
    }

    this.expectKeyword('RETURN');
    const returnVariables: string[] = [];
    do {
      const varToken = this.expect('IDENTIFIER');
      returnVariables.push(varToken.value);
    } while (this.match('COMMA'));

    return {
      source,
      edge,
      target,
      whereClauses,
      returnVariables,
    };
  }

  private parseNodePattern(): NodePattern {
    this.expect('LPAREN');
    let variable = '';
    let label: string | undefined;
    let properties: Record<string, string | number | boolean> | undefined;

    if (this.check('IDENTIFIER')) {
      variable = this.advance().value;
    }

    if (this.match('COLON')) {
      label = this.expect('IDENTIFIER').value;
    }

    if (this.match('LBRACE')) {
      properties = this.parseProperties();
      this.expect('RBRACE');
    }

    this.expect('RPAREN');

    return {
      variable: variable || 'node',
      label,
      properties,
    };
  }

  private parseEdgePattern(): EdgePattern {
    let direction: 'outgoing' | 'incoming' | 'both' = 'outgoing';
    let variable: string | undefined;
    let type: string | undefined;

    if (this.match('ARROW_LEFT')) {
      direction = 'incoming';
      if (this.match('LBRACKET')) {
        const edgeDetails = this.parseEdgeDetails();
        variable = edgeDetails.variable;
        type = edgeDetails.type;
        this.expect('RBRACKET');
      }
      this.expect('DASH');
    } else if (this.match('DASH')) {
      if (this.match('LBRACKET')) {
        const edgeDetails = this.parseEdgeDetails();
        variable = edgeDetails.variable;
        type = edgeDetails.type;
        this.expect('RBRACKET');
      }

      if (this.match('ARROW_RIGHT')) {
        direction = 'outgoing';
      } else if (this.match('DASH')) {
        direction = 'both';
      } else {
        direction = 'outgoing';
      }
    }

    return {
      variable,
      type,
      direction,
    };
  }

  private parseEdgeDetails(): { variable?: string; type?: string } {
    let variable: string | undefined;
    let type: string | undefined;

    if (this.check('IDENTIFIER')) {
      variable = this.advance().value;
    }

    if (this.match('COLON')) {
      type = this.expect('IDENTIFIER').value;
    }

    return { variable, type };
  }

  private parseProperties(): Record<string, string | number | boolean> {
    const props: Record<string, string | number | boolean> = {};

    do {
      const keyToken = this.expect('IDENTIFIER');
      this.expect('COLON');
      const valToken = this.peek();

      if (valToken.type === 'STRING') {
        props[keyToken.value] = this.advance().value;
      } else if (valToken.type === 'NUMBER') {
        props[keyToken.value] = Number(this.advance().value);
      } else if (valToken.type === 'KEYWORD' && (valToken.value === 'TRUE' || valToken.value === 'FALSE')) {
        props[keyToken.value] = this.advance().value === 'TRUE';
      } else {
        throw new Error(`Expected literal property value at line ${valToken.line}, col ${valToken.column}`);
      }
    } while (this.match('COMMA'));

    return props;
  }

  private parseWhereClause(): WhereClause {
    const identToken = this.expect('IDENTIFIER');
    const parts = identToken.value.split('.');
    const variable = parts[0] || 'node';
    const property = parts[1] || 'name';

    let operator: ComparisonOperator = '=';
    const token = this.peek();

    if (token.type === 'OPERATOR') {
      operator = this.advance().value as ComparisonOperator;
    } else if (token.type === 'KEYWORD' && ['CONTAINS', 'STARTS_WITH', 'ENDS_WITH'].includes(token.value)) {
      operator = this.advance().value as ComparisonOperator;
    } else {
      throw new Error(`Expected comparison operator, found ${token.value}`);
    }

    const valueToken = this.peek();
    let value: string | number | boolean = '';

    if (valueToken.type === 'STRING') {
      value = this.advance().value;
    } else if (valueToken.type === 'NUMBER') {
      value = Number(this.advance().value);
    } else if (valueToken.type === 'KEYWORD' && (valueToken.value === 'TRUE' || valueToken.value === 'FALSE')) {
      value = this.advance().value === 'TRUE';
    } else {
      value = this.advance().value;
    }

    return {
      variable,
      property,
      operator,
      value,
    };
  }

  private expect(type: string): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new Error(`Expected ${type}, found ${token.type} (${token.value}) at line ${token.line}`);
    }
    return this.advance();
  }

  private expectKeyword(kw: string): Token {
    const token = this.peek();
    if (token.type !== 'KEYWORD' || token.value !== kw) {
      throw new Error(`Expected keyword ${kw}, found ${token.value} at line ${token.line}`);
    }
    return this.advance();
  }

  private match(type: string): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private matchKeyword(kw: string): boolean {
    if (this.checkKeyword(kw)) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(type: string): boolean {
    return this.peek().type === type;
  }

  private checkKeyword(kw: string): boolean {
    return this.peek().type === 'KEYWORD' && this.peek().value === kw;
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: 'EOF', value: '', line: 0, column: 0 };
  }

  private advance(): Token {
    if (this.current < this.tokens.length) {
      return this.tokens[this.current++]!;
    }
    return this.peek();
  }
}

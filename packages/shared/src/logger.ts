import chalk from 'chalk';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  error: chalk.red('ERROR'),
  warn: chalk.yellow('WARN'),
  info: chalk.blue('INFO'),
  debug: chalk.gray('DEBUG'),
};

export class Logger {
  private level: LogLevel;
  private readonly prefix: string;

  constructor(prefix: string, level: LogLevel = 'info') {
    this.prefix = prefix;
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  child(prefix: string): Logger {
    return new Logger(`${this.prefix}:${prefix}`, this.level);
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (LOG_LEVEL_PRIORITY[level] > LOG_LEVEL_PRIORITY[this.level]) {
      return;
    }

    const label = LOG_LEVEL_LABELS[level];
    const prefixStr = chalk.dim(`[${this.prefix}]`);
    const timestamp = chalk.dim(new Date().toISOString().slice(11, 23));

    const formatted = args.length > 0 ? `${message} ${args.map(String).join(' ')}` : message;

    if (level === 'error') {
      console.error(`${timestamp} ${label} ${prefixStr} ${formatted}`);
    } else {
      console.log(`${timestamp} ${label} ${prefixStr} ${formatted}`);
    }
  }
}

export function createLogger(prefix: string, level?: LogLevel): Logger {
  return new Logger(prefix, level);
}

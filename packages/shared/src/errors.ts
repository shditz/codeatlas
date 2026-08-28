export class AtlasError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AtlasError';
  }
}

export class FileNotFoundError extends AtlasError {
  constructor(path: string) {
    super(`File not found: ${path}`, 'FILE_NOT_FOUND', { path });
    this.name = 'FileNotFoundError';
  }
}

export class ParseError extends AtlasError {
  constructor(filePath: string, line: number, reason: string) {
    super(`Failed to parse ${filePath} at line ${line}: ${reason}`, 'PARSE_ERROR', {
      filePath,
      line,
      reason,
    });
    this.name = 'ParseError';
  }
}

export class ConfigError extends AtlasError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigError';
  }
}

export class StorageError extends AtlasError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STORAGE_ERROR', details);
    this.name = 'StorageError';
  }
}

export class IndexError extends AtlasError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INDEX_ERROR', details);
    this.name = 'IndexError';
  }
}

export class GitError extends AtlasError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'GIT_ERROR', details);
    this.name = 'GitError';
  }
}

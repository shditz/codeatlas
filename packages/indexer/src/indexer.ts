import fs from 'node:fs';
import os from 'node:os';
import { createLogger, hashContent } from '@codeatlas/shared';
import { canParse } from '@codeatlas/core';
import { parseFile, type ParseResult } from '@codeatlas/parser';
import type { AtlasDatabase } from '@codeatlas/storage';
import {
  FileRepository,
  SymbolRepository,
  ImportRepository,
  DependencyRepository,
  SearchRepository,
  ProjectRepository,
} from '@codeatlas/storage';
import type { DependencyEdge, FileInfo } from '@codeatlas/core';
import { Scanner, type ScanOptions } from './scanner.js';

const logger = createLogger('indexer');

export interface IndexOptions extends ScanOptions {
  db: AtlasDatabase;
  projectId: number;
  concurrency?: number;
}

export interface IndexResult {
  filesIndexed: number;
  filesSkipped: number;
  filesUpdated: number;
  filesDeleted: number;
  symbolsExtracted: number;
  importsExtracted: number;
  dependenciesCreated: number;
  errors: string[];
  duration: number;
}

export class Indexer {
  private fileRepo: FileRepository;
  private symbolRepo: SymbolRepository;
  private importRepo: ImportRepository;
  private depRepo: DependencyRepository;
  private searchRepo: SearchRepository;
  private scanner: Scanner;
  private concurrency: number;

  constructor(private options: IndexOptions) {
    this.fileRepo = new FileRepository(options.db);
    this.symbolRepo = new SymbolRepository(options.db);
    this.importRepo = new ImportRepository(options.db);
    this.depRepo = new DependencyRepository(options.db);
    this.searchRepo = new SearchRepository(options.db);
    this.scanner = new Scanner(options);
    this.concurrency = Math.max(1, Math.min(options.concurrency ?? (os.cpus()?.length || 4), 16));
  }

  async index(): Promise<IndexResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let filesIndexed = 0;
    let filesSkipped = 0;
    let filesUpdated = 0;
    let filesDeleted = 0;
    let symbolsExtracted = 0;
    let importsExtracted = 0;
    let dependenciesCreated = 0;

    logger.info(`Starting indexing with concurrency pool of ${this.concurrency}...`);

    const scanResult = await this.scanner.scan();
    const files = scanResult.files;

    const projectRepo = new ProjectRepository(this.options.db);
    projectRepo.update(this.options.projectId, {
      packageManager: scanResult.project.packageManager,
      isMonorepo: scanResult.project.isMonorepo,
      languages: scanResult.project.languages,
      frameworks: scanResult.project.frameworks,
    });

    const existingHashes = this.fileRepo.getAllHashes(this.options.projectId);
    const existingPaths = new Set(existingHashes.keys());
    const currentPaths = new Set(files.map((f) => f.relativePath));

    for (const existingPath of existingPaths) {
      if (!currentPaths.has(existingPath)) {
        const existingFile = this.fileRepo.getByPath(this.options.projectId, existingPath);
        if (existingFile?.id) {
          this.searchRepo.removeFile(existingFile.id);
          this.symbolRepo.deleteByFile(existingFile.id);
        }
        this.fileRepo.delete(this.options.projectId, existingPath);
        filesDeleted++;
      }
    }

    const pendingFiles: FileInfo[] = [];
    const contentCache = new Map<string, string>();
    for (const file of files) {
      try {
        const content = fs.readFileSync(file.path, 'utf-8');
        const contentHash = hashContent(content);
        const existingHash = existingHashes.get(file.relativePath);

        if (existingHash === contentHash) {
          filesSkipped++;
          continue;
        }

        file.hash = contentHash;
        contentCache.set(file.path, content);
        pendingFiles.push(file);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to read ${file.relativePath}: ${msg}`);
      }
    }

    const dependencies: DependencyEdge[] = [];

    for (let i = 0; i < pendingFiles.length; i += this.concurrency) {
      const chunk = pendingFiles.slice(i, i + this.concurrency);

      const parsedResults = await Promise.all(
        chunk.map(async (file) => {
          try {
            const content = contentCache.get(file.path) ?? fs.readFileSync(file.path, 'utf-8');
            let parseResult: ParseResult | null = null;

            if (canParse(file.language)) {
              parseResult = await parseFile(file.relativePath, content, file.language);
            }

            return { file, content, parseResult, error: null };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { file, content: '', parseResult: null, error: msg };
          }
        }),
      );

      this.options.db.transaction(() => {
        for (const { file, content, parseResult, error } of parsedResults) {
          if (error) {
            errors.push(`Failed to parse ${file.relativePath}: ${error}`);
            continue;
          }

          try {
            if (parseResult) {
              file.symbolCount = parseResult.symbols.length;
              file.importCount = parseResult.imports.length;
              file.exportCount = parseResult.exportedNames.length;

              const fileId = this.fileRepo.upsert(this.options.projectId, file);

              this.symbolRepo.deleteByFile(fileId);
              this.importRepo.deleteByFile(fileId);

              if (parseResult.symbols.length > 0) {
                this.symbolRepo.insertBatch(fileId, parseResult.symbols);
                symbolsExtracted += parseResult.symbols.length;
              }

              if (parseResult.imports.length > 0) {
                this.importRepo.insertBatch(fileId, parseResult.imports);
                importsExtracted += parseResult.imports.length;

                for (const imp of parseResult.imports) {
                  const resolvedTarget = this.resolveImportPath(
                    file.relativePath,
                    imp.importPath,
                    currentPaths,
                  );
                  if (resolvedTarget) {
                    dependencies.push({
                      source: file.relativePath,
                      target: resolvedTarget,
                      kind: 'import',
                      symbols: imp.symbols,
                      weight: 1.0,
                    });
                  }
                }
              }

              try {
                this.searchRepo.removeFile(fileId);
              } catch {
                /* FTS entry may not exist */
              }
              this.searchRepo.indexFile(fileId, file.relativePath, content);

              if (parseResult.errors.length > 0) {
                errors.push(...parseResult.errors);
              }

              filesUpdated++;
            } else {
              const fileId = this.fileRepo.upsert(this.options.projectId, file);
              try {
                this.searchRepo.removeFile(fileId);
              } catch {
                /* FTS entry may not exist */
              }
              this.searchRepo.indexFile(fileId, file.relativePath, content);
              filesUpdated++;
            }

            filesIndexed++;
          } catch (dbErr) {
            const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
            errors.push(`Database error for ${file.relativePath}: ${msg}`);
          }
        }
      });
    }

    if (dependencies.length > 0) {
      this.depRepo.deleteAll(this.options.projectId);
      this.depRepo.insertBatch(this.options.projectId, dependencies);
      dependenciesCreated = dependencies.length;
    }

    this.options.db.run(
      `INSERT INTO index_state (project_id, file_count, symbol_count, import_count, version, hash)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id)
       DO UPDATE SET last_indexed=datetime('now'), file_count=excluded.file_count, symbol_count=excluded.symbol_count, import_count=excluded.import_count, hash=excluded.hash`,
      this.options.projectId,
      filesIndexed,
      symbolsExtracted,
      importsExtracted,
      '0.1.0',
      hashContent(String(Date.now())),
    );

    const duration = Date.now() - startTime;
    logger.info(
      `Indexing complete: ${filesIndexed} indexed, ${filesSkipped} unchanged, ${filesDeleted} deleted, ${symbolsExtracted} symbols, ${dependenciesCreated} deps in ${duration}ms`,
    );

    return {
      filesIndexed,
      filesSkipped,
      filesUpdated,
      filesDeleted,
      symbolsExtracted,
      importsExtracted,
      dependenciesCreated,
      errors,
      duration,
    };
  }

  private resolveImportPath(
    fromPath: string,
    importPath: string,
    existingPaths: Set<string>,
  ): string | undefined {
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return undefined;
    }

    const fromDir = fromPath.split('/').slice(0, -1).join('/');
    let resolved: string;

    if (importPath.startsWith('.')) {
      const parts = fromDir ? fromDir.split('/') : [];
      const importParts = importPath.split('/');

      for (const part of importParts) {
        if (part === '.') continue;
        if (part === '..') {
          parts.pop();
        } else {
          parts.push(part);
        }
      }
      resolved = parts.join('/');
    } else {
      resolved = importPath;
    }

    const extensions = [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '/index.ts',
      '/index.tsx',
      '/index.js',
      '/index.jsx',
    ];

    if (existingPaths.has(resolved)) {
      return resolved;
    }

    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (existingPaths.has(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }
}

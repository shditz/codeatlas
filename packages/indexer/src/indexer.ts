import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLogger, hashContent, normalizePath, getExtension } from '@codeatlas-ai/shared';
import {
  canParse,
  detectLanguage,
  isTestFile,
  isGeneratedFile,
  redactSecrets,
} from '@codeatlas-ai/core';
import { parseFile, resolveProjectSemantics, type ParseResult } from '@codeatlas-ai/parser';
import type { AtlasDatabase } from '@codeatlas-ai/storage';
import {
  FileRepository,
  SymbolRepository,
  ImportRepository,
  DependencyRepository,
  SearchRepository,
  ProjectRepository,
  GitMetricsRepository,
} from '@codeatlas-ai/storage';
import { GitService } from '@codeatlas-ai/git';
import type { DependencyEdge, FileInfo } from '@codeatlas-ai/core';
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
  private gitMetricsRepo: GitMetricsRepository;
  private gitService: GitService;
  private scanner: Scanner;
  private concurrency: number;

  constructor(private options: IndexOptions) {
    this.fileRepo = new FileRepository(options.db);
    this.symbolRepo = new SymbolRepository(options.db);
    this.importRepo = new ImportRepository(options.db);
    this.depRepo = new DependencyRepository(options.db);
    this.searchRepo = new SearchRepository(options.db);
    this.gitMetricsRepo = new GitMetricsRepository(options.db);
    this.gitService = new GitService(options.root);
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
        const rawContent = fs.readFileSync(file.path, 'utf-8');
        const content = redactSecrets(rawContent);
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
                      confidence: imp.confidence ?? 0.9,
                      resolution: imp.resolution ?? 'tree-sitter',
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

    const hasTsJsFiles = files.some(
      (f) => f.language === 'typescript' || f.language === 'javascript',
    );
    if (hasTsJsFiles) {
      try {
        const semanticResult = await resolveProjectSemantics(Array.from(currentPaths), {
          rootDir: this.options.root,
        });
        for (const semEdge of semanticResult.edges) {
          const existingIdx = dependencies.findIndex(
            (d) =>
              d.source === semEdge.sourceFile &&
              d.target === semEdge.targetFile &&
              d.kind === semEdge.kind,
          );
          if (existingIdx >= 0 && dependencies[existingIdx]) {
            dependencies[existingIdx] = {
              source: semEdge.sourceFile,
              target: semEdge.targetFile,
              kind: semEdge.kind,
              symbols: Array.from(
                new Set([...dependencies[existingIdx]!.symbols, ...semEdge.symbols]),
              ),
              weight: semEdge.weight,
              confidence: semEdge.confidence,
              resolution: semEdge.resolution,
            };
          } else {
            dependencies.push({
              source: semEdge.sourceFile,
              target: semEdge.targetFile,
              kind: semEdge.kind,
              symbols: semEdge.symbols,
              weight: semEdge.weight,
              confidence: semEdge.confidence,
              resolution: semEdge.resolution,
            });
          }
        }
      } catch (semErr) {
        logger.debug(`Semantic resolution fallback to AST: ${semErr}`);
      }
    }

    if (dependencies.length > 0) {
      this.depRepo.deleteAll(this.options.projectId);
      this.depRepo.insertBatch(this.options.projectId, dependencies);
      dependenciesCreated = dependencies.length;
    }

    try {
      if (this.gitService.isGitRepo()) {
        const bulkMetrics = this.gitService.getBulkFileMetrics(300);
        const metricRecords = Array.from(bulkMetrics.values()).map((m) => ({
          projectId: this.options.projectId,
          filePath: m.filePath,
          churnCount: m.churnCount,
          lastModified: m.lastModified,
          primaryOwner: m.primaryOwner,
          authors: m.authors,
        }));
        if (metricRecords.length > 0) {
          this.gitMetricsRepo.insertBatch(this.options.projectId, metricRecords);
        }
      }
    } catch (gitErr) {
      logger.debug(`Git metrics extraction skipped: ${gitErr}`);
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

  async indexFiles(targetPaths: string[]): Promise<IndexResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let filesIndexed = 0;
    let filesSkipped = 0;
    let filesUpdated = 0;
    let filesDeleted = 0;
    let symbolsExtracted = 0;
    let importsExtracted = 0;
    let dependenciesCreated = 0;

    const root = this.options.root;
    const normalizedPaths = targetPaths.map((p) => normalizePath(p).replace(/^\.?\//, ''));
    const existingHashes = this.fileRepo.getAllHashes(this.options.projectId);
    const allExistingFiles = this.fileRepo.getAll(this.options.projectId);
    const existingPaths = new Set(allExistingFiles.map((f) => f.relativePath));

    const pendingFiles: FileInfo[] = [];
    const contentCache = new Map<string, string>();

    for (const relPath of normalizedPaths) {
      const fullPath = path.resolve(root, relPath);
      if (!fs.existsSync(fullPath)) {
        const existingFile = this.fileRepo.getByPath(this.options.projectId, relPath);
        if (existingFile?.id) {
          try {
            this.searchRepo.removeFile(existingFile.id);
          } catch {
            // ignore
          }
          this.symbolRepo.deleteByFile(existingFile.id);
          this.importRepo.deleteByFile(existingFile.id);
        }
        this.fileRepo.delete(this.options.projectId, relPath);
        existingPaths.delete(relPath);
        filesDeleted++;
        continue;
      }

      try {
        const stats = fs.statSync(fullPath);
        if (!stats.isFile()) continue;

        const rawContent = fs.readFileSync(fullPath, 'utf-8');
        const content = redactSecrets(rawContent);
        const contentHash = hashContent(content);
        const existingHash = existingHashes.get(relPath);

        if (existingHash === contentHash) {
          filesSkipped++;
          continue;
        }

        const ext = getExtension(fullPath);
        const language = detectLanguage(relPath);
        const isTest = isTestFile(relPath);

        const fileInfo: FileInfo = {
          path: normalizePath(fullPath),
          relativePath: relPath,
          extension: ext,
          language,
          size: stats.size,
          hash: contentHash,
          module: relPath.split('/').slice(0, -1).join('/') || '.',
          isTest,
          isGenerated: isGeneratedFile(relPath),
          symbolCount: 0,
          importCount: 0,
          exportCount: 0,
          lastModified: Math.floor(stats.mtimeMs),
        };

        contentCache.set(fullPath, content);
        pendingFiles.push(fileInfo);
        existingPaths.add(relPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to read ${relPath}: ${msg}`);
      }
    }

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
                    existingPaths,
                  );
                  if (resolvedTarget) {
                    this.depRepo.insertBatch(this.options.projectId, [
                      {
                        source: file.relativePath,
                        target: resolvedTarget,
                        kind: 'import',
                        symbols: imp.symbols,
                        weight: 1.0,
                        confidence: imp.confidence ?? 0.9,
                        resolution: imp.resolution ?? 'tree-sitter',
                      },
                    ]);
                    dependenciesCreated++;
                  }
                }
              }

              try {
                this.searchRepo.removeFile(fileId);
              } catch {
                // ignore
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
                // ignore
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

    const duration = Date.now() - startTime;
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
      const pkgName = importPath.startsWith('@')
        ? importPath.split('/').slice(0, 2).join('/')
        : (importPath.split('/')[0] ?? '');
      const shortName = pkgName.split('/').pop() || '';
      const subPath = importPath.slice(pkgName.length).replace(/^\//, '');

      const monorepoCandidates = [
        subPath ? `packages/${shortName}/src/${subPath}.ts` : '',
        subPath ? `packages/${shortName}/src/${subPath}.js` : '',
        subPath ? `packages/${shortName}/src/${subPath}/index.ts` : '',
        `packages/${shortName}/src/index.ts`,
        `packages/${shortName}/src/index.tsx`,
        `packages/${shortName}/src/index.js`,
        `packages/${shortName}/index.ts`,
        `packages/${shortName}/index.js`,
        `apps/${shortName}/src/index.ts`,
        `apps/${shortName}/src/index.js`,
      ].filter(Boolean);

      for (const cand of monorepoCandidates) {
        if (existingPaths.has(cand)) {
          return cand;
        }
      }

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

import fs from 'node:fs';
import { createLogger, normalizePath } from '@codeatlas/shared';
import type { AtlasDatabase } from '@codeatlas/storage';
import { Indexer, type IndexResult } from './indexer.js';

const logger = createLogger('indexer:watcher');

export interface WatcherOptions {
  root: string;
  db: AtlasDatabase;
  projectId: number;
  debounceMs?: number;
  onReindex?: (result: IndexResult) => void;
  onError?: (err: Error) => void;
}

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.atlas',
  'dist',
  'build',
  '.next',
  'coverage',
  '.cache',
  '__pycache__',
  '.venv',
  'target',
];

export class RepositoryWatcher {
  private watcher: fs.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isIndexing = false;
  private pendingChanges = new Set<string>();
  private indexer: Indexer;

  constructor(private options: WatcherOptions) {
    this.indexer = new Indexer({
      root: options.root,
      db: options.db,
      projectId: options.projectId,
    });
  }

  public start(): void {
    const root = this.options.root;
    logger.info(`Starting realtime repository watcher for ${root}`);

    try {
      this.watcher = fs.watch(
        root,
        { recursive: true },
        (_eventType, filename) => {
          if (!filename) return;
          const normalized = normalizePath(filename);

          // Check ignore patterns
          for (const pattern of IGNORE_PATTERNS) {
            if (normalized.startsWith(pattern) || normalized.includes(`/${pattern}/`) || normalized.endsWith(pattern)) {
              return;
            }
          }

          this.queueChange(normalized);
        },
      );
    } catch (err) {
      logger.error('Failed to start native recursive file watcher', err);
      this.options.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private queueChange(filename: string): void {
    this.pendingChanges.add(filename);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const debounceTime = this.options.debounceMs ?? 300;
    this.debounceTimer = setTimeout(() => {
      this.triggerReindex();
    }, debounceTime);
  }

  private async triggerReindex(): Promise<void> {
    if (this.isIndexing) {
      // Re-trigger after current indexing finishes
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.triggerReindex(), 200);
      return;
    }

    const changes = Array.from(this.pendingChanges);
    this.pendingChanges.clear();

    if (changes.length === 0) return;

    this.isIndexing = true;
    logger.info(`Incremental change detected in ${changes.length} files. Re-indexing...`);

    try {
      const result = await this.indexer.index();
      logger.info(
        `Incremental index done: ${result.filesIndexed} indexed, ${result.filesUpdated} updated, ${result.filesDeleted} deleted (${result.duration}ms)`,
      );
      this.options.onReindex?.(result);
    } catch (err) {
      logger.error('Re-indexing error', err);
      this.options.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.isIndexing = false;
    }
  }

  public stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    logger.info('Stopped repository watcher');
  }
}

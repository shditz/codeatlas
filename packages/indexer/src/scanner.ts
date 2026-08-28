import fs from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
import { createLogger, normalizePath, getExtension } from '@codeatlas/shared';
import { detectLanguage, isTestFile, isGeneratedFile } from '@codeatlas/core';
import type { FileInfo, Language, ScanResult, PackageManager, Framework } from '@codeatlas/core';

const logger = createLogger('indexer:scanner');

const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  '.atlas',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'coverage',
  '.cache',
  '.tmp',
  '__pycache__',
  '.venv',
  'venv',
  'target',
  'vendor',
  '.idea',
  '.vscode',
  '.DS_Store',
  'Thumbs.db',
  '*.min.js',
  '*.min.css',
  '*.map',
  '*.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
];

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.ico',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.mp3',
  '.mp4',
  '.avi',
  '.mov',
  '.webm',
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.7z',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.sqlite',
  '.db',
]);

export interface ScanOptions {
  root: string;
  followSymlinks?: boolean;
  maxFileSize?: number;
  includeTests?: boolean;
  atlasIgnorePath?: string;
}

export class Scanner {
  private ig: ReturnType<typeof ignore>;
  private options: Required<ScanOptions>;

  constructor(options: ScanOptions) {
    this.options = {
      followSymlinks: false,
      maxFileSize: 1_048_576,
      includeTests: true,
      atlasIgnorePath: path.join(options.root, '.atlasignore'),
      ...options,
    };

    this.ig = ignore();
    this.ig.add(DEFAULT_IGNORE);
    this.loadGitignore();
    this.loadAtlasignore();
  }

  async scan(): Promise<ScanResult> {
    const startTime = Date.now();
    const files: FileInfo[] = [];
    const languageCounts = new Map<Language, number>();
    let skippedFiles = 0;

    logger.info(`Scanning ${this.options.root}`);

    await this.walkDirectory(this.options.root, (filePath, stats) => {
      const relativePath = normalizePath(path.relative(this.options.root, filePath));

      if (this.ig.ignores(relativePath)) {
        skippedFiles++;
        return;
      }

      const ext = getExtension(filePath);
      if (BINARY_EXTENSIONS.has(ext)) {
        skippedFiles++;
        return;
      }

      if (stats.size > this.options.maxFileSize) {
        skippedFiles++;
        logger.debug(`Skipping large file: ${relativePath} (${stats.size} bytes)`);
        return;
      }

      if (stats.size === 0) {
        skippedFiles++;
        return;
      }

      const language = detectLanguage(relativePath);
      const isTest = isTestFile(relativePath);
      const isGenerated = isGeneratedFile(relativePath);

      if (!this.options.includeTests && isTest) {
        skippedFiles++;
        return;
      }

      const fileInfo: FileInfo = {
        path: normalizePath(filePath),
        relativePath,
        extension: ext,
        language,
        size: stats.size,
        hash: '',
        module: this.getModule(relativePath),
        isTest,
        isGenerated,
        symbolCount: 0,
        importCount: 0,
        exportCount: 0,
        lastModified: Math.floor(stats.mtimeMs),
      };

      files.push(fileInfo);
      languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
    });

    const frameworks = this.detectFrameworks(this.options.root);
    const packageManager = this.detectPackageManager(this.options.root);
    const isMonorepo = this.detectMonorepo(this.options.root);
    const workspaces = isMonorepo ? this.detectWorkspaces(this.options.root) : [];

    const duration = Date.now() - startTime;

    logger.info(`Scan complete: ${files.length} files in ${duration}ms (${skippedFiles} skipped)`);

    return {
      project: {
        name: path.basename(this.options.root),
        root: normalizePath(this.options.root),
        languages: [...languageCounts.keys()],
        frameworks,
        packageManager,
        fileCount: files.length,
        symbolCount: 0,
        dependencyCount: 0,
        isMonorepo,
        workspaces,
      },
      detectedFiles: files.length,
      skippedFiles,
      detectedLanguages: languageCounts,
      detectedFrameworks: frameworks,
      detectedPackageManager: packageManager,
      isMonorepo,
      workspaces,
      hasTests: files.some((f) => f.isTest),
      hasDocs: this.hasDirectory(this.options.root, 'docs'),
      hasCI: this.hasDirectory(this.options.root, '.github/workflows'),
      duration,
    };
  }

  async collectFiles(): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    await this.walkDirectory(this.options.root, (filePath, stats) => {
      const relativePath = normalizePath(path.relative(this.options.root, filePath));

      if (this.ig.ignores(relativePath)) return;

      const ext = getExtension(filePath);
      if (BINARY_EXTENSIONS.has(ext)) return;
      if (stats.size > this.options.maxFileSize) return;
      if (stats.size === 0) return;

      const language = detectLanguage(relativePath);
      const isTest = isTestFile(relativePath);
      if (!this.options.includeTests && isTest) return;

      files.push({
        path: normalizePath(filePath),
        relativePath,
        extension: ext,
        language,
        size: stats.size,
        hash: '',
        module: this.getModule(relativePath),
        isTest,
        isGenerated: isGeneratedFile(relativePath),
        symbolCount: 0,
        importCount: 0,
        exportCount: 0,
        lastModified: Math.floor(stats.mtimeMs),
      });
    });

    return files;
  }

  private async walkDirectory(
    dir: string,
    callback: (filePath: string, stats: fs.Stats) => void,
  ): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      logger.debug(`Cannot read directory: ${dir} — ${(error as Error).message}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = normalizePath(path.relative(this.options.root, fullPath));

      if (entry.name.startsWith('.') && entry.name !== '.github') {
        continue;
      }

      if (this.ig.ignores(relativePath + (entry.isDirectory() ? '/' : ''))) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath);
          callback(fullPath, stats);
        } catch {
          logger.debug(`Cannot stat file: ${fullPath}`);
        }
      } else if (entry.isSymbolicLink() && this.options.followSymlinks) {
        try {
          const resolved = fs.realpathSync(fullPath);
          const stats = fs.statSync(resolved);
          if (stats.isFile()) {
            callback(resolved, stats);
          }
        } catch {
          logger.debug(`Cannot resolve symlink: ${fullPath}`);
        }
      }
    }
  }

  private getModule(relativePath: string): string {
    const parts = relativePath.split('/');
    if (parts.length <= 1) return '.';
    return parts.slice(0, -1).join('/');
  }

  private loadGitignore(): void {
    const gitignorePath = path.join(this.options.root, '.gitignore');
    try {
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf-8');
        this.ig.add(content);
      }
    } catch {
      logger.debug('Could not read .gitignore');
    }
  }

  private loadAtlasignore(): void {
    try {
      if (fs.existsSync(this.options.atlasIgnorePath)) {
        const content = fs.readFileSync(this.options.atlasIgnorePath, 'utf-8');
        this.ig.add(content);
      }
    } catch {
      logger.debug('Could not read .atlasignore');
    }
  }

  private detectPackageManager(root: string): PackageManager {
    if (
      fs.existsSync(path.join(root, 'pnpm-lock.yaml')) ||
      fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))
    )
      return 'pnpm';
    if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(root, 'bun.lockb'))) return 'bun';
    if (fs.existsSync(path.join(root, 'package-lock.json'))) return 'npm';
    if (fs.existsSync(path.join(root, 'package.json'))) return 'npm';
    return 'unknown';
  }

  private detectFrameworks(root: string): Framework[] {
    const frameworks: Framework[] = [];
    const pkgPath = path.join(root, 'package.json');

    if (!fs.existsSync(pkgPath)) return frameworks;

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
      const allDeps = {
        ...((pkg['dependencies'] as Record<string, string> | undefined) ?? {}),
        ...((pkg['devDependencies'] as Record<string, string> | undefined) ?? {}),
      };

      if ('next' in allDeps) frameworks.push('next');
      if ('react' in allDeps) frameworks.push('react');
      if ('vue' in allDeps) frameworks.push('vue');
      if ('svelte' in allDeps || '@sveltejs/kit' in allDeps) frameworks.push('svelte');
      if ('@angular/core' in allDeps) frameworks.push('angular');
      if ('express' in allDeps) frameworks.push('express');
      if ('fastify' in allDeps) frameworks.push('fastify');
      if ('@nestjs/core' in allDeps) frameworks.push('nestjs');
    } catch {
      logger.debug('Could not parse package.json for framework detection');
    }

    return frameworks;
  }

  private detectMonorepo(root: string): boolean {
    if (fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))) return true;
    if (fs.existsSync(path.join(root, 'lerna.json'))) return true;
    if (fs.existsSync(path.join(root, 'nx.json'))) return true;

    try {
      const pkgPath = path.join(root, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
        if (pkg['workspaces']) return true;
      }
    } catch {}

    return false;
  }

  private detectWorkspaces(root: string): string[] {
    const workspaces: string[] = [];

    try {
      const pkgPath = path.join(root, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
        const ws = pkg['workspaces'];
        if (Array.isArray(ws)) {
          workspaces.push(...(ws as string[]));
        }
      }
    } catch {}

    return workspaces;
  }

  private hasDirectory(root: string, dirName: string): boolean {
    return fs.existsSync(path.join(root, dirName));
  }
}

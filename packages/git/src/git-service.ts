import { execSync } from 'node:child_process';
import { createLogger, GitError } from '@codeatlas/shared';

const logger = createLogger('git');

export interface GitStatus {
  branch: string;
  isGitRepo: boolean;
  modifiedFiles: string[];
  stagedFiles: string[];
  untrackedFiles: string[];
  hasChanges: boolean;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitFileHistory {
  path: string;
  commits: GitCommit[];
  lastModified: string;
}

export class GitService {
  constructor(private readonly cwd: string) {}

  isGitRepo(): boolean {
    try {
      this.exec('git rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  getStatus(): GitStatus {
    if (!this.isGitRepo()) {
      return {
        branch: '',
        isGitRepo: false,
        modifiedFiles: [],
        stagedFiles: [],
        untrackedFiles: [],
        hasChanges: false,
      };
    }

    let branch = 'main';
    try {
      branch = this.exec('git symbolic-ref --short HEAD').trim();
    } catch {
      try {
        branch = this.exec('git rev-parse --abbrev-ref HEAD').trim();
      } catch {
        branch = 'main';
      }
    }

    let statusOutput = '';
    try {
      statusOutput = this.exec('git status --porcelain');
    } catch {
      statusOutput = '';
    }

    const modifiedFiles: string[] = [];
    const stagedFiles: string[] = [];
    const untrackedFiles: string[] = [];

    for (const line of statusOutput.split('\n').filter(Boolean)) {
      const status = line.slice(0, 2);
      const file = line.slice(3).trim();

      if (status.startsWith('?')) {
        untrackedFiles.push(file);
      } else {
        if (status[0] !== ' ' && status[0] !== '?') {
          stagedFiles.push(file);
        }
        if (status[1] !== ' ' && status[1] !== '?') {
          modifiedFiles.push(file);
        }
      }
    }

    return {
      branch,
      isGitRepo: true,
      modifiedFiles,
      stagedFiles,
      untrackedFiles,
      hasChanges: modifiedFiles.length + stagedFiles.length + untrackedFiles.length > 0,
    };
  }

  getRecentCommits(limit: number = 10): GitCommit[] {
    if (!this.isGitRepo()) return [];

    try {
      const output = this.exec(`git log --format="%H|%h|%s|%an|%aI" -n ${limit}`);

      return output
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const parts = line.split('|');
          return {
            hash: parts[0] ?? '',
            shortHash: parts[1] ?? '',
            message: parts[2] ?? '',
            author: parts[3] ?? '',
            date: parts[4] ?? '',
          };
        });
    } catch {
      return [];
    }
  }

  getFileLastModified(filePath: string): string | undefined {
    if (!this.isGitRepo()) return undefined;

    try {
      const output = this.exec(`git log -1 --format="%aI" -- "${filePath}"`);
      return output.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  getChangedFiles(since?: string): string[] {
    if (!this.isGitRepo()) return [];

    try {
      const ref = since ?? 'HEAD~10';
      const output = this.exec(`git diff --name-only ${ref}`);
      return output.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  getStagedChangedFiles(): string[] {
    if (!this.isGitRepo()) return [];

    try {
      const output = this.exec('git diff --cached --name-only');
      return output.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  getBranchChangedFiles(baseBranch: string = 'main'): string[] {
    if (!this.isGitRepo()) return [];

    try {
      const output = this.exec(`git diff --name-only ${baseBranch}...HEAD`);
      return output.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  getDiff(filePath?: string): string {
    if (!this.isGitRepo()) return '';

    try {
      const cmd = filePath ? `git diff -- "${filePath}"` : 'git diff';
      return this.exec(cmd);
    } catch {
      return '';
    }
  }

  getStagedDiff(): string {
    if (!this.isGitRepo()) return '';

    try {
      return this.exec('git diff --cached');
    } catch {
      return '';
    }
  }

  getBranchDiff(baseBranch: string = 'main'): string {
    if (!this.isGitRepo()) return '';

    try {
      return this.exec(`git diff ${baseBranch}...HEAD`);
    } catch {
      return '';
    }
  }

  private exec(command: string): string {
    try {
      return execSync(command, {
        cwd: this.cwd,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug(`Git command failed: ${command} — ${message}`);
      throw new GitError(`Git command failed: ${message}`, { command });
    }
  }
}

import { describe, it, expect } from 'vitest';
import { GitService } from '../git-service.js';

describe('GitService', () => {
  const git = new GitService(process.cwd());

  it('detects if the current directory is a git repo', () => {
    expect(git.isGitRepo()).toBe(true);
  });

  it('fetches git repository status', () => {
    const status = git.getStatus();
    expect(status.isGitRepo).toBe(true);
    expect(status.branch).toBeDefined();
    expect(Array.isArray(status.modifiedFiles)).toBe(true);
    expect(Array.isArray(status.stagedFiles)).toBe(true);
    expect(Array.isArray(status.untrackedFiles)).toBe(true);
  });

  it('fetches recent commits', () => {
    const commits = git.getRecentCommits(5);
    expect(Array.isArray(commits)).toBe(true);
    if (commits.length > 0) {
      expect(commits[0]).toHaveProperty('hash');
      expect(commits[0]).toHaveProperty('shortHash');
      expect(commits[0]).toHaveProperty('message');
      expect(commits[0]).toHaveProperty('author');
      expect(commits[0]).toHaveProperty('date');
    }
  });

  it('handles non-git repository gracefully', () => {
    const fakeGit = new GitService('C:/non-existent-directory-xyz');
    expect(fakeGit.isGitRepo()).toBe(false);
    expect(fakeGit.getStatus().isGitRepo).toBe(false);
    expect(fakeGit.getRecentCommits()).toEqual([]);
    expect(fakeGit.getFileLastModified('foo.ts')).toBeUndefined();
    expect(fakeGit.getChangedFiles()).toEqual([]);
    expect(fakeGit.getDiff()).toBe('');
  });
});

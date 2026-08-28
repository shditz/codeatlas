import { describe, it, expect, vi } from 'vitest';
import * as core from '@actions/core';
import { run } from '../index.js';

vi.mock('@actions/core');
vi.mock('@actions/github', () => ({
  context: {
    payload: {},
    repo: { owner: 'test', repo: 'test' },
  },
  getOctokit: vi.fn(),
}));

describe('CodeAtlas GitHub Action', () => {
  it('runs without crashing when no changed files are present', async () => {
    vi.spyOn(core, 'getInput').mockImplementation((name: string) => {
      if (name === 'base-branch') return 'main';
      if (name === 'post-comment') return 'false';
      return '';
    });

    await expect(run()).resolves.not.toThrow();
  });
});

import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { ensureInitialized, openDatabase, getOrCreateProject, loadConfig } from '../utils.js';
import { FileRepository, DependencyRepository } from '@codeatlas/storage';
import { DependencyGraph } from '@codeatlas/graph';
import { GitService } from '@codeatlas/git';
import { ContextEngine } from '@codeatlas/context';
import { RuleEngine } from '@codeatlas/rules';
import { createExporter, type ExportTarget } from '@codeatlas/exporters';
import type { FileInfo, ProjectMeta } from '@codeatlas/core';
import type { RankedResult } from '@codeatlas/ranking';

export function registerDiffCommand(program: Command): void {
  program
    .command('diff')
    .description('Generate targeted AI context pack based on current git diff or staged changes')
    .option('--staged', 'Use staged git changes only')
    .option('--base <branch>', 'Base branch to compare against (e.g. main)')
    .option('--target <agent>', 'Export target format (e.g. markdown, deepseek, trae, kimi, cursor)', 'markdown')
    .option('--budget <tokens>', 'Token budget')
    .option('--output <path>', 'Output file path')
    .action(async (options: {
      staged?: boolean;
      base?: string;
      target: string;
      budget?: string;
      output?: string;
    }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const git = new GitService(cwd);
      if (!git.isGitRepo()) {
        console.error(chalk.red('Error: Current directory is not a git repository.'));
        process.exit(1);
      }

      let changedFiles: string[] = [];
      let diffContent = '';

      if (options.staged) {
        changedFiles = git.getStagedChangedFiles();
        diffContent = git.getStagedDiff();
      } else if (options.base) {
        changedFiles = git.getBranchChangedFiles(options.base);
        diffContent = git.getBranchDiff(options.base);
      } else {
        const status = git.getStatus();
        changedFiles = Array.from(new Set([...status.modifiedFiles, ...status.stagedFiles]));
        diffContent = git.getDiff();
      }

      if (changedFiles.length === 0) {
        console.log(chalk.yellow('No changed files detected in git working tree.'));
        return;
      }

      console.log(chalk.bold(`Generating Context for Git Diff (${changedFiles.length} modified files)`));

      const config = loadConfig(cwd);
      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);

      const fileRepo = new FileRepository(db);
      const files = fileRepo.getAll(projectId);
      const filesByPath = new Map<string, FileInfo>(files.map((f) => [f.relativePath, f]));

      const depRepo = new DependencyRepository(db);
      const deps = depRepo.getAll(projectId);
      const graph = new DependencyGraph();
      graph.addEdges(deps);

      // Find dependent files (callers / consumers of changed files)
      const affectedFiles = new Set<string>(changedFiles);
      for (const file of changedFiles) {
        const dependents = graph.getDependents(file);
        for (const dep of dependents) {
          affectedFiles.add(dep);
        }
      }

      const rankedResults: RankedResult[] = [];
      for (const filePath of affectedFiles) {
        const fileInfo = filesByPath.get(filePath);
        if (!fileInfo) continue;

        const isDirectChange = changedFiles.includes(filePath);
        const score = isDirectChange ? 1.0 : 0.7;

        rankedResults.push({
          filePath,
          relevance: score,
          explanations: [
            {
              signal: 'dependency',
              score,
              weight: 1,
              reason: isDirectChange ? 'Git modified file' : 'Direct dependent of modified file',
            },
          ],
          candidate: {
            filePath,
            file: fileInfo,
            sources: [
              {
                type: 'path' as const,
                score,
                detail: isDirectChange ? 'Modified file' : 'Dependent file',
              },
            ],
          },
        });
      }

      // Sort by score descending
      rankedResults.sort((a, b) => b.relevance - a.relevance);

      const ruleEngine = new RuleEngine(cwd);
      const rules = ruleEngine.discover();

      const project = db.get<Record<string, unknown>>(
        'SELECT * FROM projects WHERE id = ?',
        projectId,
      );
      const projectMeta: ProjectMeta = {
        name: (project?.['name'] as string) ?? path.basename(cwd),
        root: cwd.replace(/\\/g, '/'),
        languages: JSON.parse((project?.['languages'] as string) ?? '[]'),
        frameworks: JSON.parse((project?.['frameworks'] as string) ?? '[]'),
        packageManager: (project?.['package_manager'] as ProjectMeta['packageManager']) ?? 'pnpm',
        fileCount: files.length,
        symbolCount: 0,
        dependencyCount: deps.length,
        isMonorepo: (project?.['is_monorepo'] as number) === 1,
        workspaces: JSON.parse((project?.['workspaces'] as string) ?? '[]'),
      };

      const budget = parseInt(options.budget ?? '', 10) || config.context.max_tokens;
      const contextEngine = new ContextEngine({
        tokenBudget: budget,
        defaultMode: config.context.default_mode,
        repositoryRoot: cwd,
      });

      const taskName = `Git Diff: ${changedFiles.slice(0, 3).join(', ')}${changedFiles.length > 3 ? ` +${changedFiles.length - 3} more` : ''}`;
      const contextPack = contextEngine.build({
        task: taskName,
        project: projectMeta,
        rankedResults,
        rules,
      });

      db.close();

      const target = options.target as ExportTarget;
      const exporter = createExporter(target);
      let content = exporter.export(contextPack, { target });

      if (diffContent) {
        content = `${content}\n\n# Git Unified Diff\n\`\`\`diff\n${diffContent.slice(0, 15000)}\n\`\`\`\n`;
      }

      const outputPath = options.output ?? path.join(cwd, `diff-context.${exporter.defaultFilename()}`);
      fs.writeFileSync(outputPath, content, 'utf-8');

      console.log(chalk.green(`  ✓ Exported diff context to ${path.relative(cwd, outputPath)}`));
      console.log(chalk.dim(`  ${contextPack.files.length} relevant files included (${contextPack.tokenUsage.toLocaleString()} tokens)`));
    });
}

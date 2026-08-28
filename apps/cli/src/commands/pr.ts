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

export function registerPrCommand(program: Command): void {
  program
    .command('pr')
    .description('Generate a complete Pull Request review context pack for AI code reviewers')
    .option('--base <branch>', 'Base branch to compare (default: main)', 'main')
    .option('--target <agent>', 'Export target agent format', 'markdown')
    .option('--budget <tokens>', 'Token budget')
    .option('--output <path>', 'Output file path')
    .action(async (options: { base: string; target: string; budget?: string; output?: string }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const config = loadConfig(cwd);
      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);
      const git = new GitService(cwd);

      const baseBranch = options.base;
      const changedFiles = await git.getBranchChangedFiles(baseBranch);

      if (changedFiles.length === 0) {
        console.log(chalk.yellow(`No changed files detected compared to branch "${baseBranch}".`));
        db.close();
        return;
      }

      console.log(chalk.bold.blue('🗺️  Analyzing Pull Request changes...'));
      console.log(chalk.dim(`Base branch: ${baseBranch}`));
      console.log(chalk.dim(`Changed files: ${changedFiles.length}`));

      const fileRepo = new FileRepository(db);
      const depRepo = new DependencyRepository(db);
      const files = fileRepo.getAll(projectId);
      const deps = depRepo.getAll(projectId);

      const graph = new DependencyGraph();
      for (const dep of deps) {
        graph.addEdge(dep);
      }

      const affectedFiles = new Set<string>(changedFiles);
      for (const file of changedFiles) {
        const dependents = graph.getDependents(file, 1);
        for (const dep of dependents) {
          affectedFiles.add(dep);
        }
      }

      const fileMap = new Map<string, FileInfo>();
      for (const file of files) {
        fileMap.set(file.relativePath, file);
      }

      const rankedResults: RankedResult[] = [];
      for (const file of affectedFiles) {
        const isDirectChange = changedFiles.includes(file);
        const fileInfo = fileMap.get(file);
        const score = isDirectChange ? 1.0 : 0.7;

        rankedResults.push({
          filePath: file,
          relevance: score,
          explanations: [
            {
              signal: 'dependency',
              score,
              weight: 1,
              reason: isDirectChange ? 'PR Changed File' : 'Dependent Component',
            },
          ],
          candidate: {
            filePath: file,
            file: fileInfo,
            sources: [
              {
                type: 'path' as const,
                score,
                detail: isDirectChange ? 'PR Changed File' : 'Dependent Component',
              },
            ],
          },
        });
      }

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

      const taskName = `PR Review Context (vs ${options.base}): ${changedFiles.length} files changed`;
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

      const recentCommits = await git.getRecentCommits(5);
      const diffContent = await git.getBranchDiff(options.base);

      let prHeader = `\n# Pull Request Review Guide\n\n- **Base Branch**: \`${options.base}\`\n- **Files Modified**: ${changedFiles.length}\n`;
      if (recentCommits.length > 0) {
        prHeader +=
          `\n### Recent PR Commits\n` +
          recentCommits
            .map(
              (c: { shortHash: string; message: string; author: string }) =>
                `- \`${c.shortHash}\` ${c.message} (${c.author})`,
            )
            .join('\n') +
          '\n';
      }
      if (diffContent) {
        prHeader += `\n### Unified Diff\n\`\`\`diff\n${diffContent.slice(0, 20000)}\n\`\`\`\n`;
      }

      content = `${content}\n${prHeader}`;

      const outputPath =
        options.output ?? path.join(cwd, `pr-review-context.${exporter.defaultFilename()}`);
      fs.writeFileSync(outputPath, content, 'utf-8');

      console.log(
        chalk.green(`  ✓ Exported PR review context to ${path.relative(cwd, outputPath)}`),
      );
      console.log(
        chalk.dim(
          `  ${contextPack.files.length} relevant files included (${contextPack.tokenUsage.toLocaleString()} tokens)`,
        ),
      );
    });
}

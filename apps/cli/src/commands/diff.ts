import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ensureInitialized, openDatabase, getOrCreateProject, loadConfig } from '../utils.js';
import { FileRepository, DependencyRepository } from '@codeatlas-ai/storage';
import { DependencyGraph } from '@codeatlas-ai/graph';
import { GitService } from '@codeatlas-ai/git';
import { ContextEngine } from '@codeatlas-ai/context';
import { RuleEngine } from '@codeatlas-ai/rules';
import { createExporter, type ExportTarget } from '@codeatlas-ai/exporters';
import type { FileInfo, ProjectMeta } from '@codeatlas-ai/core';
import type { RankedResult } from '@codeatlas-ai/ranking';

export function registerDiffCommand(program: Command): void {
  program
    .command('diff')
    .description('Generate targeted AI context pack and semantic blast-radius for git changes')
    .option('--staged', 'Use staged git changes only')
    .option('--base <branch>', 'Base branch to compare against (e.g. main)')
    .option(
      '--target <agent>',
      'Export target format (e.g. markdown, deepseek, trae, kimi, cursor)',
      'markdown',
    )
    .option('--budget <tokens>', 'Token budget')
    .option('--output <path>', 'Output file path')
    .option('--json', 'Output blast radius and affected files as JSON')
    .action(
      async (options: {
        staged?: boolean;
        base?: string;
        target: string;
        budget?: string;
        output?: string;
        json?: boolean;
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

        // Compute Blast Radius
        const blastRadius = graph.getBlastRadius(changedFiles);

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                changedFiles,
                directlyAffected: blastRadius.directlyAffected,
                transitivelyAffected: blastRadius.transitivelyAffected,
                totalAffected:
                  changedFiles.length +
                  blastRadius.directlyAffected.length +
                  blastRadius.transitivelyAffected.length,
              },
              null,
              2,
            ),
          );
          db.close();
          return;
        }

        console.log(chalk.bold.cyan('\n💥 Semantic Blast Radius Analysis\n'));

        const table = new Table({
          head: [chalk.bold('Impact Level'), chalk.bold('Count'), chalk.bold('Files')],
          colWidths: [22, 9, 50],
          wordWrap: true,
        });

        table.push(
          [
            chalk.yellow('Direct Modifications'),
            changedFiles.length.toString(),
            changedFiles.slice(0, 5).join('\n') +
              (changedFiles.length > 5 ? `\n... +${changedFiles.length - 5} more` : ''),
          ],
          [
            chalk.red('Direct Dependents'),
            blastRadius.directlyAffected.length.toString(),
            blastRadius.directlyAffected.length > 0
              ? blastRadius.directlyAffected.slice(0, 5).join('\n') +
                (blastRadius.directlyAffected.length > 5
                  ? `\n... +${blastRadius.directlyAffected.length - 5} more`
                  : '')
              : chalk.dim('(none)'),
          ],
          [
            chalk.magenta('Transitive Dependents'),
            blastRadius.transitivelyAffected.length.toString(),
            blastRadius.transitivelyAffected.length > 0
              ? blastRadius.transitivelyAffected.slice(0, 5).join('\n') +
                (blastRadius.transitivelyAffected.length > 5
                  ? `\n... +${blastRadius.transitivelyAffected.length - 5} more`
                  : '')
              : chalk.dim('(none)'),
          ],
        );

        console.log(table.toString());
        
        let severityColor = chalk.green;
        if (blastRadius.severity === 'CRITICAL') severityColor = chalk.bgRed.white.bold;
        else if (blastRadius.severity === 'HIGH') severityColor = chalk.red.bold;
        else if (blastRadius.severity === 'MEDIUM') severityColor = chalk.yellow.bold;
        
        console.log(`\n  Predicted Impact Severity: ${severityColor(` ${blastRadius.severity} `)}\n`);

        const affectedFiles = new Set<string>([
          ...changedFiles,
          ...blastRadius.directlyAffected,
          ...blastRadius.transitivelyAffected,
        ]);

        const rankedResults: RankedResult[] = [];
        for (const filePath of affectedFiles) {
          const fileInfo = filesByPath.get(filePath);
          if (!fileInfo) continue;

          const isDirectChange = changedFiles.includes(filePath);
          const isDirectDep = blastRadius.directlyAffected.includes(filePath);
          const score = isDirectChange ? 1.0 : isDirectDep ? 0.8 : 0.5;

          rankedResults.push({
            filePath,
            relevance: score,
            explanations: [
              {
                signal: 'dependency',
                score,
                weight: 1,
                reason: isDirectChange
                  ? 'Git modified file'
                  : isDirectDep
                    ? 'Direct dependent in blast radius'
                    : 'Transitive dependent in blast radius',
              },
            ],
            candidate: {
              filePath,
              file: fileInfo,
              sources: [
                {
                  type: 'path' as const,
                  score,
                  detail: isDirectChange ? 'Modified file' : 'Blast radius dependent',
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

        const taskName = `Git Diff & Blast Radius: ${changedFiles.slice(0, 3).join(', ')}${changedFiles.length > 3 ? ` +${changedFiles.length - 3} more` : ''}`;
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

        const outputPath =
          options.output ?? path.join(cwd, `diff-context.${exporter.defaultFilename()}`);
        fs.writeFileSync(outputPath, content, 'utf-8');

        console.log(chalk.green(`\n✔ Exported diff context to ${path.relative(cwd, outputPath)}`));
        console.log(
          chalk.dim(
            `  ${contextPack.files.length} relevant files included (${contextPack.tokenUsage.toLocaleString()} tokens)\n`,
          ),
        );
      },
    );
}

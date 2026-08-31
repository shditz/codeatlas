import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { defaultConfig } from '@codeatlas-ai/core';
import { AtlasDatabase, runMigrations } from '@codeatlas-ai/storage';
import { Scanner } from '@codeatlas-ai/indexer';
import { McpConfigurator } from '@codeatlas-ai/mcp';
import {
  getAtlasDir,
  getConfigPath,
  getDbPath,
  isInitialized,
  generateConfigTOML,
} from '../utils.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize CodeAtlas with smart project detection')
    .option('--force', 'Reinitialize even if already initialized')
    .option('--mcp', 'Automatically configure MCP for detected AI coding assistants')
    .option('--no-mcp', 'Skip MCP configuration')
    .action(async (options: { force?: boolean; mcp?: boolean }) => {
      const cwd = process.cwd();

      if (isInitialized(cwd) && !options.force) {
        console.log(chalk.yellow('\n⚠ CodeAtlas is already initialized in this directory.'));
        console.log(chalk.dim('  Use --force to reinitialize.\n'));
        return;
      }

      console.log(chalk.bold.cyan('\n🚀 Initializing CodeAtlas Intelligence Hub\n'));

      const spinner = ora('Analyzing repository environment & architecture...').start();

      let scanResult;
      try {
        const scanner = new Scanner({ root: cwd });
        scanResult = await scanner.scan();
        spinner.succeed('Repository environment analyzed successfully');
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        spinner.warn(`Scan warning: ${errorMsg}. Proceeding with default template.`);
      }

      const atlasDir = getAtlasDir(cwd);
      fs.mkdirSync(atlasDir, { recursive: true });
      fs.mkdirSync(path.join(atlasDir, 'snapshots'), { recursive: true });
      fs.mkdirSync(path.join(atlasDir, 'cache'), { recursive: true });

      const config = defaultConfig();
      config.project.name = scanResult?.project.name || path.basename(cwd);

      if (scanResult?.isMonorepo) {
        config.context.max_tokens = 16000;
        config.ranking.module_weight = 0.2;
      }

      const configContent = generateConfigTOML(config);
      fs.writeFileSync(getConfigPath(cwd), configContent, 'utf-8');

      const db = new AtlasDatabase(getDbPath(cwd));
      runMigrations(db);

      const normalizedRoot = cwd.replace(/\\/g, '/');
      const languages = scanResult ? JSON.stringify(scanResult.project.languages) : '[]';
      const frameworks = scanResult ? JSON.stringify(scanResult.project.frameworks) : '[]';
      const workspaces = scanResult ? JSON.stringify(scanResult.workspaces) : '[]';
      const packageManager = scanResult?.detectedPackageManager || 'unknown';
      const isMonorepo = scanResult?.isMonorepo ? 1 : 0;

      const existingProject = db.get<{ id: number }>(
        'SELECT id FROM projects WHERE root = ?',
        normalizedRoot,
      );

      if (existingProject) {
        db.run(
          `UPDATE projects SET
           name = ?,
           package_manager = ?,
           is_monorepo = ?,
           languages = ?,
           frameworks = ?,
           workspaces = ?,
           updated_at = datetime('now')
           WHERE id = ?`,
          config.project.name,
          packageManager,
          isMonorepo,
          languages,
          frameworks,
          workspaces,
          existingProject.id,
        );
      } else {
        db.run(
          `INSERT INTO projects (name, root, package_manager, is_monorepo, languages, frameworks, workspaces)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          config.project.name,
          normalizedRoot,
          packageManager,
          isMonorepo,
          languages,
          frameworks,
          workspaces,
        );
      }

      db.close();

      const ignorePath = path.join(cwd, '.atlasignore');
      if (!fs.existsSync(ignorePath) || options.force) {
        const ignorePatterns = [
          '# =========================================',
          '# CodeAtlas Smart Ignore Configuration',
          '# Auto-generated based on detected tech stack',
          '# =========================================',
          '',
          '# Security & Secrets',
          '.env',
          '.env.*',
          '*.pem',
          '*.key',
          '*.cert',
          '*.pfx',
          'secrets/',
          '',
          '# Build & Dependency Artifacts',
        ];

        const detectedLangs = new Set(
          (scanResult?.project.languages || []).map((l: string) => l.toLowerCase()),
        );

        if (
          detectedLangs.has('typescript') ||
          detectedLangs.has('javascript') ||
          fs.existsSync(path.join(cwd, 'package.json'))
        ) {
          ignorePatterns.push(
            '# Node.js & Web',
            'node_modules/',
            'dist/',
            'build/',
            'out/',
            '.next/',
            '.nuxt/',
            '.svelte-kit/',
            '.turbo/',
            'coverage/',
            '',
          );
        }

        if (
          detectedLangs.has('python') ||
          fs.existsSync(path.join(cwd, 'pyproject.toml')) ||
          fs.existsSync(path.join(cwd, 'requirements.txt'))
        ) {
          ignorePatterns.push(
            '# Python',
            '__pycache__/',
            '.venv/',
            'venv/',
            '*.pyc',
            '.pytest_cache/',
            '.mypy_cache/',
            '',
          );
        }

        if (detectedLangs.has('rust') || fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
          ignorePatterns.push('# Rust', 'target/', '');
        }

        if (detectedLangs.has('go') || fs.existsSync(path.join(cwd, 'go.mod'))) {
          ignorePatterns.push('# Go', 'vendor/', 'bin/', '');
        }

        if (
          detectedLangs.has('java') ||
          detectedLangs.has('kotlin') ||
          fs.existsSync(path.join(cwd, 'pom.xml')) ||
          fs.existsSync(path.join(cwd, 'build.gradle'))
        ) {
          ignorePatterns.push('# JVM / Gradle / Maven', 'build/', '.gradle/', 'target/', '');
        }

        fs.writeFileSync(ignorePath, ignorePatterns.join('\n'), 'utf-8');
      }

      console.log('');
      console.log(chalk.bold('  📦 Setup Completed'));
      console.log(`    ${chalk.green('✓')} Configuration  ${chalk.dim('.atlas/config.toml')}`);
      console.log(`    ${chalk.green('✓')} Database       ${chalk.dim('.atlas/atlas.db')}`);
      console.log(`    ${chalk.green('✓')} Smart Ignore   ${chalk.dim('.atlasignore')}`);
      console.log('');

      if (scanResult) {
        console.log(chalk.bold('  🧠 Detected Environment'));
        console.log(
          `    ${chalk.dim('Languages:')}    ${
            scanResult.project.languages.length > 0
              ? scanResult.project.languages.join(', ')
              : 'Generic'
          }`,
        );
        if (scanResult.project.frameworks.length > 0) {
          console.log(
            `    ${chalk.dim('Frameworks:')}   ${scanResult.project.frameworks.join(', ')}`,
          );
        }
        console.log(`    ${chalk.dim('Package Mgr:')}   ${scanResult.detectedPackageManager}`);
        console.log(
          `    ${chalk.dim('Monorepo:')}      ${scanResult.isMonorepo ? chalk.green('Yes') : 'No'}`,
        );
        console.log(
          `    ${chalk.dim('File Count:')}    ${scanResult.detectedFiles.toLocaleString()}`,
        );
        console.log('');
      }

      const configurator = new McpConfigurator(cwd);
      const detectedAssistants = configurator.detectAssistants();

      if (options.mcp) {
        const results = await configurator.configureAllDetected();
        console.log(chalk.bold('  🧭 MCP Multi-Agent Integration:'));
        for (const res of results) {
          console.log(`    ${chalk.green('✓')} ${res.targetName} (${chalk.dim(res.filePath)})`);
        }
        console.log('');
      } else if (options.mcp !== false && detectedAssistants.length > 0) {
        console.log(chalk.bold('  🤖 Detected AI Coding Assistants:'));
        for (const ast of detectedAssistants) {
          const status = ast.isConfigured
            ? chalk.green('[Configured]')
            : chalk.yellow('[Ready to setup]');
          console.log(`    - ${chalk.cyan(ast.name)} ${status}`);
        }
        console.log(
          chalk.dim('    Run ') +
            chalk.cyan('atlas mcp setup') +
            chalk.dim(' to connect CodeAtlas to these assistants.\n'),
        );
      }

      console.log(chalk.bold('  💡 Next Steps:'));
      console.log(
        chalk.cyan('    atlas index     ') + chalk.dim('— Build deep AST & dependency graph'),
      );
      console.log(
        chalk.cyan('    atlas mcp setup ') +
          chalk.dim('— 1-Click setup for AI assistants (Cursor, Antigravity, Claude, etc.)'),
      );
      console.log(
        chalk.cyan('    atlas context   ') +
          chalk.dim('— Generate task context pack for AI agent\n'),
      );
    });
}

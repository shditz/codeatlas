import type { Command } from 'commander';
import chalk from 'chalk';
import { ensureInitialized, openDatabase, getOrCreateProject } from '../utils.js';
import { FileRepository, SymbolRepository } from '@codeatlas/storage';

export function registerMapCommand(program: Command): void {
  program
    .command('map')
    .description('Display the repository map with symbols')
    .option('--depth <n>', 'Max directory depth', '3')
    .option('--symbols', 'Include symbols in the map', true)
    .option('--json', 'Output as JSON')
    .action(async (options: { depth: string; symbols: boolean; json?: boolean }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);
      const fileRepo = new FileRepository(db);
      const symbolRepo = new SymbolRepository(db);

      const files = fileRepo.getAll(projectId);

      if (files.length === 0) {
        console.log(chalk.yellow('No files indexed. Run: atlas index'));
        db.close();
        return;
      }

      if (options.json) {
        const data = files.map((f) => ({
          ...f,
          symbols: options.symbols ? symbolRepo.getByFile(f.id!) : [],
        }));
        console.log(JSON.stringify(data, null, 2));
        db.close();
        return;
      }

      console.log('');
      console.log(chalk.bold('Repository Map'));
      console.log('');

      // Build tree
      const tree = new Map<string, typeof files>();
      for (const file of files) {
        const module = file.module || '.';
        if (!tree.has(module)) tree.set(module, []);
        tree.get(module)!.push(file);
      }

      const maxDepth = parseInt(options.depth, 10);
      const sortedModules = [...tree.keys()].sort();

      for (const module of sortedModules) {
        const depth = module === '.' ? 0 : module.split('/').length;
        if (depth > maxDepth) continue;

        const indent = '  '.repeat(depth);
        const moduleFiles = tree.get(module)!;

        console.log(`${indent}${chalk.blue(module === '.' ? '.' : module + '/')}`);

        for (const file of moduleFiles.sort((a, b) =>
          a.relativePath.localeCompare(b.relativePath),
        )) {
          const basename = file.relativePath.split('/').pop() ?? file.relativePath;
          const langIcon = getLangIcon(file.language);
          console.log(
            `${indent}  ${langIcon} ${chalk.white(basename)} ${chalk.dim(`(${file.symbolCount} symbols)`)}`,
          );

          if (options.symbols && file.id) {
            const symbols = symbolRepo.getByFile(file.id);
            const exported = symbols.filter((s) => s.exported);
            for (const sym of exported.slice(0, 8)) {
              const kindIcon = getKindIcon(sym.kind);
              console.log(`${indent}    ${kindIcon} ${chalk.dim(sym.name)}`);
            }
            if (exported.length > 8) {
              console.log(`${indent}    ${chalk.dim(`... +${exported.length - 8} more`)}`);
            }
          }
        }
      }

      db.close();
      console.log('');
    });
}

function getLangIcon(lang: string): string {
  const icons: Record<string, string> = {
    typescript: chalk.blue('TS'),
    javascript: chalk.yellow('JS'),
    python: chalk.green('PY'),
    go: chalk.cyan('GO'),
    rust: chalk.red('RS'),
    json: chalk.gray('{}'),
    yaml: chalk.gray('YA'),
    markdown: chalk.gray('MD'),
  };
  return icons[lang] ?? chalk.gray('  ');
}

function getKindIcon(kind: string): string {
  const icons: Record<string, string> = {
    class: chalk.yellow('◆'),
    function: chalk.blue('ƒ'),
    method: chalk.blue('→'),
    interface: chalk.green('◇'),
    type: chalk.magenta('T'),
    enum: chalk.cyan('E'),
    variable: chalk.gray('v'),
    constant: chalk.gray('C'),
  };
  return icons[kind] ?? chalk.gray('·');
}

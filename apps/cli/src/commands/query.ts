import type { Command } from 'commander';
import chalk from 'chalk';
import { ensureInitialized, openDatabase, getOrCreateProject, loadConfig } from '../utils.js';
import { FileRepository, SymbolRepository, DependencyRepository } from '@codeatlas-ai/storage';
import {
  DependencyGraph,
  GraphQueryEngine,
  type GraphNodeItem,
  type GraphEdgeItem,
} from '@codeatlas-ai/graph';
import { NaturalLanguageToCypher } from '@codeatlas-ai/nl2cypher';
import { createLLMProvider } from '@codeatlas-ai/llm';

export function registerQueryCommand(program: Command): void {
  program
    .command('query <queryStr>')
    .description('Run a Cypher or natural language graph query against the codebase architecture')
    .option('-n, --nl', 'Treat queryStr as natural language and automatically translate to Cypher')
    .option('--json', 'Output raw JSON result')
    .action(async (queryStr: string, options: { nl?: boolean; json?: boolean }) => {
      const cwd = process.cwd();
      ensureInitialized(cwd);

      const db = openDatabase(cwd);
      const projectId = getOrCreateProject(db, cwd);
      const config = loadConfig(cwd);

      let targetCypher = queryStr;

      if (options.nl || !queryStr.trim().toUpperCase().startsWith('MATCH')) {
        const llm = createLLMProvider({
          provider: config.ai.provider || 'none',
        });
        const translator = new NaturalLanguageToCypher(llm);
        const translation = await translator.translate(queryStr);
        targetCypher = translation.query;

        if (!options.json) {
          console.log(
            chalk.dim(`[NL2Cypher] Converted to: `) +
              chalk.cyan.bold(targetCypher) +
              chalk.dim(` (${translation.source})`),
          );
        }
      }

      const fileRepo = new FileRepository(db);
      const symbolRepo = new SymbolRepository(db);
      const depRepo = new DependencyRepository(db);

      const files = fileRepo.getAll(projectId);
      const symbols = files.flatMap((f) =>
        f.id ? symbolRepo.getByFile(f.id).map((s) => ({ ...s, filePath: f.relativePath })) : [],
      );
      const deps = depRepo.getAll(projectId);

      const nodes: GraphNodeItem[] = [
        ...files.map((f) => ({
          id: f.relativePath,
          label: 'File',
          properties: {
            name: f.relativePath.split('/').pop() || f.relativePath,
            path: f.relativePath,
            language: f.language,
            lines: f.size,
          },
        })),
        ...symbols.map((s) => ({
          id: `${s.filePath}:${s.name}`,
          label: 'Symbol',
          properties: {
            name: s.name,
            kind: s.kind,
            file: s.filePath,
            line: s.line,
          },
        })),
      ];

      const edges: GraphEdgeItem[] = deps.map((d) => ({
        source: d.source,
        target: d.target,
        type: d.kind.toUpperCase(),
        properties: { weight: d.weight },
      }));

      const graph = new DependencyGraph();
      const engine = new GraphQueryEngine(graph, nodes, edges);

      try {
        const result = engine.execute(targetCypher);

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          db.close();
          return;
        }

        console.log('');
        console.log(chalk.bold.cyan('CodeAtlas Graph Query Execution'));
        console.log(chalk.dim(`Query: ${targetCypher}`));
        console.log(
          chalk.dim(`Execution Time: ${result.executionTimeMs}ms | Returned Rows: ${result.count}`),
        );
        console.log('');

        if (result.count === 0) {
          console.log(chalk.yellow('No matching nodes or relationships found.'));
        } else {
          console.table(result.rows);
        }
        console.log('');
      } catch (err) {
        console.error(
          chalk.red(`Query Execution Error: ${err instanceof Error ? err.message : String(err)}`),
        );
      } finally {
        db.close();
      }
    });
}

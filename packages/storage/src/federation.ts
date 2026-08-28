import path from 'node:path';
import fs from 'node:fs';
import type { AtlasDatabase } from './database.js';
import { createLogger } from '@codeatlas-ai/shared';

const logger = createLogger('storage:federation');

export interface FederatedRepoInfo {
  alias: string;
  name: string;
  root: string;
  dbPath: string;
  attached: boolean;
}

export interface CrossRepoSymbolResult {
  repo: string;
  name: string;
  kind: string;
  file: string;
  line: number;
}

export class FederationService {
  constructor(private primaryDb: AtlasDatabase) {}

  public attachRepo(targetRepoPath: string, customAlias?: string): FederatedRepoInfo {
    const resolvedRoot = path.resolve(targetRepoPath);
    const dbPath = path.join(resolvedRoot, '.atlas', 'atlas.db');

    if (!fs.existsSync(dbPath)) {
      throw new Error(
        `CodeAtlas database not found at ${dbPath}. Run 'atlas index' in '${resolvedRoot}' first.`,
      );
    }

    const repoName = path.basename(resolvedRoot);
    const alias = customAlias || `repo_${repoName.replace(/[^a-zA-Z0-9_]/g, '_')}`;

    this.primaryDb.attach(dbPath, alias);
    logger.info(`Federated repo '${repoName}' as '${alias}' from ${dbPath}`);

    return {
      alias,
      name: repoName,
      root: resolvedRoot,
      dbPath,
      attached: true,
    };
  }

  public detachRepo(alias: string): void {
    this.primaryDb.detach(alias);
    logger.info(`Detached federated repo '${alias}'`);
  }

  public listFederated(): Array<{ seq: number; name: string; file: string }> {
    return this.primaryDb.getAttached();
  }

  public searchCrossRepoSymbols(query: string, limit: number = 20): CrossRepoSymbolResult[] {
    const attached = this.listFederated();
    const results: CrossRepoSymbolResult[] = [];

    for (const dbInfo of attached) {
      const prefix = dbInfo.name === 'main' ? '' : `${dbInfo.name}.`;
      try {
        const rows = this.primaryDb.all<Record<string, unknown>>(
          `SELECT name, kind, line, (SELECT relative_path FROM ${prefix}files WHERE id = ${prefix}symbols.file_id) as file_path
           FROM ${prefix}symbols
           WHERE name LIKE ?
           LIMIT ?`,
          `%${query}%`,
          limit,
        );

        for (const r of rows) {
          results.push({
            repo: dbInfo.name,
            name: (r['name'] as string) || '',
            kind: (r['kind'] as string) || '',
            file: (r['file_path'] as string) || '',
            line: (r['line'] as number) || 1,
          });
        }
      } catch (err) {
        logger.debug(`Could not query symbols in schema '${dbInfo.name}':`, err);
      }
    }

    return results.slice(0, limit);
  }
}

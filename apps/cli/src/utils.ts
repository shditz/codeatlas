import fs from 'node:fs';
import path from 'node:path';
import type { AtlasConfig } from '@codeatlas-ai/core';
import { defaultConfig } from '@codeatlas-ai/core';
import { AtlasDatabase, runMigrations } from '@codeatlas-ai/storage';

const ATLAS_DIR = '.atlas';
const CONFIG_FILE = 'config.toml';

export function getAtlasDir(cwd: string = process.cwd()): string {
  return path.join(cwd, ATLAS_DIR);
}

export function getConfigPath(cwd: string = process.cwd()): string {
  return path.join(getAtlasDir(cwd), CONFIG_FILE);
}

export function getDbPath(cwd: string = process.cwd()): string {
  const dir = getAtlasDir(cwd);
  if (fs.existsSync(path.join(dir, 'atlas.db'))) return path.join(dir, 'atlas.db');
  if (fs.existsSync(path.join(dir, 'atlas.db'))) return path.join(dir, 'atlas.db');
  return path.join(dir, 'atlas.db');
}

export function isInitialized(cwd: string = process.cwd()): boolean {
  return fs.existsSync(getAtlasDir(cwd));
}

export function ensureInitialized(cwd: string = process.cwd()): void {
  if (!isInitialized(cwd)) {
    console.error('CodeAtlas is not initialized in this directory.');
    console.error('Run: atlas init');
    process.exit(1);
  }
}

export function openDatabase(cwd: string = process.cwd()): AtlasDatabase {
  const dbPath = getDbPath(cwd);
  const db = new AtlasDatabase(dbPath);
  runMigrations(db);
  return db;
}

export function loadConfig(cwd: string = process.cwd()): AtlasConfig {
  const configPath = getConfigPath(cwd);

  if (!fs.existsSync(configPath)) {
    return defaultConfig();
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = parseTOML(content);
    return { ...defaultConfig(), ...parsed } as AtlasConfig;
  } catch {
    return defaultConfig();
  }
}

export function getOrCreateProject(db: AtlasDatabase, cwd: string): number {
  const normalizedRoot = cwd.replace(/\\/g, '/');
  const existing = db.get<{ id: number }>('SELECT id FROM projects WHERE root = ?', normalizedRoot);

  if (existing) {
    return existing.id;
  }

  const name = path.basename(cwd);
  const result = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', name, normalizedRoot);
  return Number(result.lastInsertRowid);
}

function parseTOML(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentSection: Record<string, unknown> = result;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      const sectionPath = (sectionMatch[1] ?? '').split('.');
      let target: Record<string, unknown> = result;
      for (let i = 0; i < sectionPath.length - 1; i++) {
        const p = sectionPath[i]!;
        if (!target[p] || typeof target[p] !== 'object') {
          target[p] = {};
        }
        target = target[p] as Record<string, unknown>;
      }
      const lastKey = sectionPath[sectionPath.length - 1]!;
      if (!target[lastKey] || typeof target[lastKey] !== 'object') {
        target[lastKey] = {};
      }
      currentSection = target[lastKey] as Record<string, unknown>;
      continue;
    }

    const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1] ?? '';
      let value: unknown = kvMatch[2] ?? '';

      // Parse value
      const strValue = (value as string).trim();
      if (strValue === 'true') value = true;
      else if (strValue === 'false') value = false;
      else if (strValue.startsWith('"') && strValue.endsWith('"')) value = strValue.slice(1, -1);
      else if (strValue.startsWith("'") && strValue.endsWith("'")) value = strValue.slice(1, -1);
      else if (strValue.startsWith('[')) {
        try {
          value = JSON.parse(strValue.replace(/'/g, '"'));
        } catch {
          /* keep string */
        }
      } else if (!isNaN(Number(strValue))) value = Number(strValue);

      if (key) {
        currentSection[key] = value;
      }
    }
  }

  return result;
}

export function generateConfigTOML(config: AtlasConfig): string {
  const lines: string[] = [];

  lines.push('[project]');
  lines.push(`name = "${config.project.name}"`);
  lines.push('');

  lines.push('[index]');
  lines.push(`follow_symlinks = ${config.index.follow_symlinks}`);
  lines.push(`include_tests = ${config.index.include_tests}`);
  lines.push(`max_file_size = ${config.index.max_file_size}`);
  lines.push('');

  lines.push('[context]');
  lines.push(`max_tokens = ${config.context.max_tokens}`);
  lines.push(`default_mode = "${config.context.default_mode}"`);
  lines.push('');

  lines.push('[ranking]');
  lines.push(`lexical_weight = ${config.ranking.lexical_weight}`);
  lines.push(`symbol_weight = ${config.ranking.symbol_weight}`);
  lines.push(`path_weight = ${config.ranking.path_weight}`);
  lines.push(`dependency_weight = ${config.ranking.dependency_weight}`);
  lines.push(`rule_weight = ${config.ranking.rule_weight}`);
  lines.push(`recency_weight = ${config.ranking.recency_weight}`);
  lines.push(`module_weight = ${config.ranking.module_weight}`);
  lines.push('');

  lines.push('[security]');
  lines.push(`scan_secrets = ${config.security.scan_secrets}`);
  lines.push(`exclude_patterns = ${JSON.stringify(config.security.exclude_patterns)}`);
  lines.push('');

  lines.push('[architecture]');
  lines.push(`type = "${config.architecture?.type || 'auto'}"`);
  lines.push('');

  lines.push('[architecture.rules]');
  lines.push(`allow = ${JSON.stringify(config.architecture?.rules?.allow || [])}`);
  lines.push(`disallow = ${JSON.stringify(config.architecture?.rules?.disallow || [])}`);
  lines.push(`enforce_public_api = ${config.architecture?.rules?.enforce_public_api ?? true}`);
  lines.push('');

  lines.push('[ai]');
  lines.push(`provider = "${config.ai.provider}"`);
  lines.push('');

  return lines.join('\n');
}

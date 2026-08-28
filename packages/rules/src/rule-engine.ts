import fs from 'node:fs';
import path from 'node:path';
import type { Rule, RuleSource, RuleConflict } from '@codeatlas/core';
import { createLogger, hashContent } from '@codeatlas/shared';

const logger = createLogger('rules');

interface RuleFileSpec {
  pattern: string;
  source: RuleSource;
  agentTarget?: string;
}

const RULE_FILES: RuleFileSpec[] = [
  { pattern: 'AGENTS.md', source: 'agents.md', agentTarget: 'agents' },
  { pattern: 'CLAUDE.md', source: 'claude.md', agentTarget: 'claude' },
  { pattern: 'GEMINI.md', source: 'gemini.md', agentTarget: 'gemini' },
  { pattern: 'ANTIGRAVITY.md', source: 'custom', agentTarget: 'antigravity' },
  { pattern: 'DEEPSEEK.md', source: 'deepseek', agentTarget: 'deepseek' },
  { pattern: 'QWEN.md', source: 'qwen', agentTarget: 'qwen' },
  { pattern: 'KIMI.md', source: 'kimi', agentTarget: 'kimi' },
  { pattern: 'GROK.md', source: 'grok', agentTarget: 'grok' },
  { pattern: 'DEVIN.md', source: 'devin', agentTarget: 'devin' },
  { pattern: 'OPENHANDS.md', source: 'openhands', agentTarget: 'openhands' },
  { pattern: 'REPLIT.md', source: 'replit', agentTarget: 'replit' },
  { pattern: 'AMAZONQ.md', source: 'amazonq', agentTarget: 'amazonq' },
  { pattern: '.github/copilot-instructions.md', source: 'copilot', agentTarget: 'copilot' },
  { pattern: '.cursorrules', source: 'cursor', agentTarget: 'cursor' },
  { pattern: '.windsurfrules', source: 'custom', agentTarget: 'windsurf' },
  { pattern: '.clinerules', source: 'custom', agentTarget: 'cline' },
  { pattern: '.traerules', source: 'trae', agentTarget: 'trae' },
  { pattern: '.lingmarules', source: 'lingma', agentTarget: 'lingma' },
  { pattern: '.comaterules', source: 'comate', agentTarget: 'comate' },
  { pattern: '.codegeexrules', source: 'codegeex', agentTarget: 'codegeex' },
  { pattern: '.roorules', source: 'roo', agentTarget: 'roo' },
  { pattern: '.augmentrules', source: 'augment', agentTarget: 'augment' },
  { pattern: '.continuerc.json', source: 'continue', agentTarget: 'continue' },
];

const RULE_DIRECTORIES: Array<{ dir: string; source: RuleSource; agentTarget: string }> = [
  { dir: '.cursor/rules', source: 'cursor', agentTarget: 'cursor' },
  { dir: '.github/instructions', source: 'copilot', agentTarget: 'copilot' },
  { dir: '.continue/rules', source: 'continue', agentTarget: 'continue' },
  { dir: '.trae/rules', source: 'trae', agentTarget: 'trae' },
];

export class RuleEngine {
  private rules: Rule[] = [];

  constructor(private readonly root: string) {}

  discover(): Rule[] {
    this.rules = [];

    // Discover root-level rule files
    for (const spec of RULE_FILES) {
      this.discoverFile(spec.pattern, spec.source, 'global', spec.agentTarget);
    }

    // Discover rule directories
    for (const spec of RULE_DIRECTORIES) {
      this.discoverDirectory(spec.dir, spec.source, spec.agentTarget);
    }

    // Discover nested AGENTS.md, CLAUDE.md, GEMINI.md
    this.discoverNestedRules();

    logger.info(`Discovered ${this.rules.length} rules`);
    return this.rules;
  }

  getRules(): Rule[] {
    return this.rules;
  }

  getApplicableRules(filePath: string): Rule[] {
    return this.rules.filter((rule) => {
      if (rule.scope === 'global') return true;
      if (rule.scope === 'path' && rule.pathPattern) {
        const normalizedPath = filePath.replace(/\\/g, '/');
        const pattern = rule.pathPattern.replace(/\\/g, '/');
        return normalizedPath.startsWith(pattern);
      }
      return false;
    });
  }

  detectConflicts(): RuleConflict[] {
    const conflicts: RuleConflict[] = [];

    for (let i = 0; i < this.rules.length; i++) {
      for (let j = i + 1; j < this.rules.length; j++) {
        const ruleA = this.rules[i];
        const ruleB = this.rules[j];
        if (!ruleA || !ruleB) continue;

        const conflict = this.checkConflict(ruleA, ruleB);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    if (conflicts.length > 0) {
      logger.info(`Detected ${conflicts.length} rule conflicts`);
    }

    return conflicts;
  }

  validate(): Array<{ rule: Rule; issue: string; severity: 'error' | 'warning' | 'info' }> {
    const issues: Array<{
      rule: Rule;
      issue: string;
      severity: 'error' | 'warning' | 'info';
    }> = [];

    for (const rule of this.rules) {
      // Check for empty rules
      if (!rule.content.trim()) {
        issues.push({
          rule,
          issue: 'Rule file is empty',
          severity: 'warning',
        });
      }

      // Check for very long rules
      if (rule.content.length > 10_000) {
        issues.push({
          rule,
          issue: `Rule is very large (${rule.content.length} chars). Consider breaking it up.`,
          severity: 'info',
        });
      }

      // Check for duplicate content
      const duplicates = this.rules.filter(
        (r) => r.id !== rule.id && r.content.trim() === rule.content.trim(),
      );
      if (duplicates.length > 0) {
        issues.push({
          rule,
          issue: `Duplicate content found in: ${duplicates.map((d) => d.filePath).join(', ')}`,
          severity: 'info',
        });
      }
    }

    return issues;
  }

  private discoverFile(
    relativePath: string,
    source: RuleSource,
    scope: 'global' | 'path',
    agentTarget?: string,
  ): void {
    const fullPath = path.join(this.root, relativePath);

    if (!fs.existsSync(fullPath)) return;

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      this.rules.push({
        id: hashContent(relativePath).slice(0, 12),
        source,
        scope,
        filePath: relativePath,
        content,
        priority: this.getPriority(source, scope),
        agentTarget,
      });
      logger.debug(`Found rule: ${relativePath} (${source})`);
    } catch {
      logger.debug(`Could not read rule file: ${relativePath}`);
    }
  }

  private discoverDirectory(dirRelative: string, source: RuleSource, agentTarget: string): void {
    const dirPath = path.join(this.root, dirRelative);
    if (!fs.existsSync(dirPath)) return;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdc'))) {
          const relativePath = `${dirRelative}/${entry.name}`;
          this.discoverFile(relativePath, source, 'path', agentTarget);
        }
      }
    } catch {
      logger.debug(`Could not read rule directory: ${dirRelative}`);
    }
  }

  private discoverNestedRules(): void {
    const nestedPatterns = [
      'AGENTS.md',
      'CLAUDE.md',
      'GEMINI.md',
      'TRAE.md',
      'DEEPSEEK.md',
      'QWEN.md',
      'KIMI.md',
    ];
    this.walkForRules(this.root, nestedPatterns, 0, 3);
  }

  private walkForRules(dir: string, patterns: string[], depth: number, maxDepth: number): void {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isFile() && patterns.includes(entry.name) && depth > 0) {
        const relativePath = path.relative(this.root, fullPath).replace(/\\/g, '/');
        const pathPrefix = path.dirname(relativePath);
        const source: RuleSource = entry.name.toLowerCase().includes('agents')
          ? 'agents.md'
          : entry.name.toLowerCase().includes('claude')
            ? 'claude.md'
            : entry.name.toLowerCase().includes('gemini')
              ? 'gemini.md'
              : 'custom';

        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          this.rules.push({
            id: hashContent(relativePath).slice(0, 12),
            source,
            scope: 'path',
            filePath: relativePath,
            content,
            priority: this.getPriority(source, 'path'),
            pathPattern: pathPrefix,
          });
        } catch {
          // ignore read error
        }
      }

      if (entry.isDirectory()) {
        this.walkForRules(fullPath, patterns, depth + 1, maxDepth);
      }
    }
  }

  private getPriority(source: RuleSource, scope: 'global' | 'path'): number {
    const basePriority: Record<RuleSource, number> = {
      'agents.md': 10,
      'claude.md': 8,
      'gemini.md': 8,
      cursor: 6,
      copilot: 6,
      atlas: 12,
      custom: 5,
      trae: 7,
      deepseek: 8,
      qwen: 7,
      lingma: 7,
      comate: 6,
      codegeex: 6,
      kimi: 7,
      grok: 7,
      replit: 6,
      devin: 8,
      opencode: 6,
      vellum: 6,
      openhands: 7,
      continue: 6,
      roo: 7,
      augment: 6,
      amazonq: 6,
    };
    const base = basePriority[source] ?? 5;
    return scope === 'path' ? base + 2 : base;
  }

  private checkConflict(ruleA: Rule, ruleB: Rule): RuleConflict | null {
    const contentA = ruleA.content.toLowerCase();
    const contentB = ruleB.content.toLowerCase();

    // Check for tab vs spaces conflict
    const aUseTabs = contentA.includes('use tabs') || contentA.includes('indent with tabs');
    const aUseSpaces =
      contentA.includes('use spaces') ||
      contentA.includes('use 2 spaces') ||
      contentA.includes('use 4 spaces');
    const bUseTabs = contentB.includes('use tabs') || contentB.includes('indent with tabs');
    const bUseSpaces =
      contentB.includes('use spaces') ||
      contentB.includes('use 2 spaces') ||
      contentB.includes('use 4 spaces');

    if ((aUseTabs && bUseSpaces) || (aUseSpaces && bUseTabs)) {
      return {
        ruleA,
        ruleB,
        reason: 'Conflicting indentation rules (tabs vs spaces)',
        severity: 'warning',
        suggestion:
          ruleA.priority >= ruleB.priority
            ? `Prefer ${ruleA.filePath}`
            : `Prefer ${ruleB.filePath}`,
      };
    }

    // Check for single vs double quotes conflict
    const aSingleQuote = contentA.includes('single quote') || contentA.includes("use '");
    const aDoubleQuote = contentA.includes('double quote') || contentA.includes('use "');
    const bSingleQuote = contentB.includes('single quote') || contentB.includes("use '");
    const bDoubleQuote = contentB.includes('double quote') || contentB.includes('use "');

    if ((aSingleQuote && bDoubleQuote) || (aDoubleQuote && bSingleQuote)) {
      return {
        ruleA,
        ruleB,
        reason: 'Conflicting quote style rules (single vs double quotes)',
        severity: 'warning',
        suggestion:
          ruleA.priority >= ruleB.priority
            ? `Prefer ${ruleA.filePath}`
            : `Prefer ${ruleB.filePath}`,
      };
    }

    // Check for semicolon rules
    const aNoSemi = contentA.includes('no semicolon') || contentA.includes('no-semi');
    const aSemi = contentA.includes('use semicolon') || contentA.includes('always use semi');
    const bNoSemi = contentB.includes('no semicolon') || contentB.includes('no-semi');
    const bSemi = contentB.includes('use semicolon') || contentB.includes('always use semi');

    if ((aNoSemi && bSemi) || (aSemi && bNoSemi)) {
      return {
        ruleA,
        ruleB,
        reason: 'Conflicting semicolon rules',
        severity: 'warning',
        suggestion:
          ruleA.priority >= ruleB.priority
            ? `Prefer ${ruleA.filePath}`
            : `Prefer ${ruleB.filePath}`,
      };
    }

    return null;
  }
}

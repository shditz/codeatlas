import fs from 'node:fs';
import path from 'node:path';
import type {
  ArchitectureReport,
  PackageManager,
  ScanResult,
} from '@codeatlas-ai/core';



export interface ProposedRule {
  id: string;
  category: 'architecture' | 'testing' | 'typescript' | 'code-style' | 'workflow' | 'security';
  title: string;
  ruleText: string;
  evidence: string;
  confidence: 'high' | 'medium';
  recommended: boolean;
}

export interface RuleGeneratorOptions {
  rootDir: string;
  scanResult?: ScanResult;
  architectureReport?: ArchitectureReport;
}

export class RuleGenerator {
  private rootDir: string;
  private scanResult?: ScanResult;
  private architectureReport?: ArchitectureReport;

  constructor(options: RuleGeneratorOptions) {
    this.rootDir = options.rootDir;
    this.scanResult = options.scanResult;
    this.architectureReport = options.architectureReport;
  }

  generateProposedRules(): ProposedRule[] {
    const proposed: ProposedRule[] = [];

    const tsConfigPath = path.join(this.rootDir, 'tsconfig.json');
    let isTsStrict = false;
    let tsTarget = 'ES2022';
    if (fs.existsSync(tsConfigPath)) {
      try {
        const raw = fs.readFileSync(tsConfigPath, 'utf-8');
        if (raw.includes('"strict": true') || raw.includes('"strict":true')) {
          isTsStrict = true;
        }
        const targetMatch = raw.match(/"target"\s*:\s*"([^"]+)"/i);
        if (targetMatch && targetMatch[1]) {
          tsTarget = targetMatch[1];
        }
      } catch {
        // ignore parse error
      }
    }

    const languages = this.scanResult?.detectedLanguages
      ? Object.keys(this.scanResult.detectedLanguages)
      : ['typescript'];

    if (languages.includes('typescript')) {
      proposed.push({
        id: 'ts_strict_types',
        category: 'typescript',
        title: 'Strict Typing & No Explicit Any',
        ruleText:
          'Maintain strict type safety across all modules. Define explicit parameter/return interfaces, utilize discriminated unions, and avoid using `any`.',
        evidence: isTsStrict
          ? `tsconfig.json enforces "strict": true with target "${tsTarget}".`
          : `Project uses TypeScript across ${this.scanResult?.detectedFiles || 'multiple'} files.`,
        confidence: 'high',
        recommended: true,
      });
    }

    const pkgJsonPath = path.join(this.rootDir, 'package.json');
    let scripts: Record<string, string> = {};
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        scripts = pkg.scripts || {};
      } catch {
        // ignore
      }
    }

    const pm: PackageManager = this.scanResult?.detectedPackageManager || 'npm';

    if (scripts['build'] || scripts['typecheck']) {
      const verifyCmds = [
        scripts['typecheck'] ? `${pm} run typecheck` : null,
        scripts['build'] ? `${pm} run build` : null,
      ]
        .filter(Boolean)
        .join(' && ');

      proposed.push({
        id: 'workflow_build_verification',
        category: 'workflow',
        title: 'Mandatory Build & Typecheck Verification',
        ruleText: `Always verify all TypeScript/build errors before finalizing changes by running: \`${verifyCmds}\`.`,
        evidence: `Found build scripts in package.json using package manager "${pm}".`,
        confidence: 'high',
        recommended: true,
      });
    }

    const hasVitest =
      fs.existsSync(path.join(this.rootDir, 'vitest.config.ts')) ||
      fs.existsSync(path.join(this.rootDir, 'vitest.config.js')) ||
      scripts['test']?.includes('vitest');

    const hasJest =
      fs.existsSync(path.join(this.rootDir, 'jest.config.js')) ||
      fs.existsSync(path.join(this.rootDir, 'jest.config.ts')) ||
      scripts['test']?.includes('jest');

    if (hasVitest) {
      proposed.push({
        id: 'test_vitest_framework',
        category: 'testing',
        title: 'Vitest Unit & Integration Testing Standards',
        ruleText: `Use Vitest for all new test suites. Follow the \`__tests__/*.test.ts\` co-location pattern and execute \`${pm} test\` to validate.`,
        evidence: 'Detected vitest configuration and test runner in repository.',
        confidence: 'high',
        recommended: true,
      });
    } else if (hasJest) {
      proposed.push({
        id: 'test_jest_framework',
        category: 'testing',
        title: 'Jest Testing Standards',
        ruleText: `Write unit tests with Jest following existing test suite conventions. Run \`${pm} test\` before submitting changes.`,
        evidence: 'Detected Jest configuration in repository.',
        confidence: 'high',
        recommended: true,
      });
    }

    if (this.architectureReport) {
      const layers = this.architectureReport.layers || [];
      const layerNames = layers.map((l) => l.name).filter(Boolean);

      if (layerNames.includes('presentation') && layerNames.includes('application')) {
        proposed.push({
          id: 'arch_layered_controllers_services',
          category: 'architecture',
          title: 'Layered Flow: Controllers Must Delegate to Services',
          ruleText:
            'Controllers / Presentation handlers must strictly delegate business logic to Application Services and never execute direct database queries.',
          evidence: `CodeAtlas Architecture Analyzer detected active layers: [${layerNames.join(', ')}].`,
          confidence: 'high',
          recommended: true,
        });
      }

      if (layerNames.includes('domain') && layerNames.includes('infrastructure')) {
        proposed.push({
          id: 'arch_dependency_inversion',
          category: 'architecture',
          title: 'Dependency Inversion: Pure Domain Entities',
          ruleText:
            'Domain models and entities must remain pure. They must never directly import database, file system, or infrastructure adapter packages.',
          evidence: `Detected Domain Driven Design (DDD) domain and infrastructure layer boundaries.`,
          confidence: 'high',
          recommended: true,
        });
      }

      const boundedContexts = this.architectureReport.boundedContexts || [];
      if (boundedContexts.length > 1) {
        const sampleContexts = boundedContexts.slice(0, 4).map((c) => c.name).join(', ');
        proposed.push({
          id: 'arch_bounded_context_public_api',
          category: 'architecture',
          title: 'Public API Encapsulation Across Bounded Contexts',
          ruleText:
            'When referencing symbols from another module/bounded context, always import from its public entry point (`index.ts` / root export) rather than internal private paths.',
          evidence: `Detected ${boundedContexts.length} isolated bounded contexts (${sampleContexts}).`,
          confidence: 'high',
          recommended: true,
        });
      }
    }

    if (this.scanResult?.isMonorepo && (this.scanResult.workspaces || []).length > 0) {
      const workspaces = this.scanResult.workspaces;
      proposed.push({
        id: 'arch_monorepo_boundaries',
        category: 'architecture',
        title: 'Monorepo Workspace Independence',
        ruleText: `Preserve workspace isolation across [${workspaces.join(', ')}]. Depend on sibling packages via workspace protocols and avoid relative path imports reaching outside package roots.`,
        evidence: `Monorepo workspace configuration detected with ${workspaces.length} workspace directories.`,
        confidence: 'high',
        recommended: true,
      });
    }

    const hasPrettier =
      fs.existsSync(path.join(this.rootDir, 'prettier.config.mjs')) ||
      fs.existsSync(path.join(this.rootDir, '.prettierrc')) ||
      fs.existsSync(path.join(this.rootDir, '.prettierrc.json'));

    const hasEslint =
      fs.existsSync(path.join(this.rootDir, 'eslint.config.mjs')) ||
      fs.existsSync(path.join(this.rootDir, 'eslint.config.js')) ||
      fs.existsSync(path.join(this.rootDir, '.eslintrc.json'));

    if (hasPrettier || hasEslint) {
      proposed.push({
        id: 'code_style_linters',
        category: 'code-style',
        title: 'Automated Linting & Formatting Compliance',
        ruleText:
          'Preserve established code formatting (Prettier) and linter rules (ESLint). Do not disable lint checks with ad-hoc comments without explicit rationale.',
        evidence: `Detected active linter configurations: ${[hasEslint ? 'ESLint' : null, hasPrettier ? 'Prettier' : null].filter(Boolean).join(', ')}.`,
        confidence: 'high',
        recommended: true,
      });
    }

    return proposed;
  }

  generateRuleDocument(
    approvedRules: ProposedRule[],
    meta: {
      name: string;
      languages: string[];
      frameworks: string[];
      packageManager: string;
      isMonorepo?: boolean;
      workspaces?: string[];
    },
    targetName: string,
  ): string {
    const header = `# ${meta.name} — AI Coding Guidelines (${targetName.toUpperCase()})

> Evidence-based guidelines verified and approved by the engineering team.
> Generated by CodeAtlas (https://github.com/shditz/codeatlas)

## 🏗️ Verified Tech Stack & Environment
- **Project**: ${meta.name}
- **Languages**: ${meta.languages.join(', ') || 'TypeScript'}
- **Frameworks & Core Libraries**: ${meta.frameworks.join(', ') || 'Standard Libraries'}
- **Package Manager**: ${meta.packageManager}
${meta.isMonorepo ? `- **Monorepo Workspaces**: ${(meta.workspaces || []).join(', ')}` : ''}

## 🧠 CodeAtlas Context & Navigation Directives
1. **Precise Context**: Use \`atlas context "<task description>"\` (or \`atlas_context\` MCP tool) to retrieve focused AST context packs instead of full-file scans.
2. **Architecture Validation**: Run \`atlas analyze\` to verify your changes do not introduce circular dependencies, dead code, or architectural layer regressions.
3. **Execution Tracing**: Use \`atlas_trace_execution_path\` via MCP to verify dependency call paths before refactoring.

## 🛡️ Approved Engineering Rules & Architectural Directives
`;

    const sections: Record<string, string[]> = {
      architecture: [],
      typescript: [],
      testing: [],
      'code-style': [],
      workflow: [],
      security: [],
    };

    for (const rule of approvedRules) {
      const section = sections[rule.category] || sections['workflow']!;
      section.push(`### ${rule.title}
- **Rule**: ${rule.ruleText}
- *Evidence*: _${rule.evidence}_
`);
    }

    let body = '';
    const sectionTitles: Record<string, string> = {
      architecture: '🏛️ Architecture & Bounded Contexts',
      typescript: '📐 Type Safety & Language Standards',
      testing: '🧪 Testing & Verification',
      'code-style': '🎨 Code Style & Consistency',
      workflow: '⚡ Workflow & Build Directives',
      security: '🔒 Security & Data Integrity',
    };

    for (const [key, items] of Object.entries(sections)) {
      if (items.length > 0) {
        body += `\n## ${sectionTitles[key] || key}\n\n` + items.join('\n');
      }
    }

    return header + body;
  }
}

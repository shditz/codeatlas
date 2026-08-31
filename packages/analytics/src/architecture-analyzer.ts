import type {
  ArchitectureConfig,
  ArchitectureLayer,
  ArchitectureLayerType,
  ArchitectureReport,
  ArchitectureViolation,
  BoundedContext,
  FileInfo,
} from '@codeatlas-ai/core';
import type { DependencyGraph } from '@codeatlas-ai/graph';
import { createLogger } from '@codeatlas-ai/shared';

const logger = createLogger('analytics:architecture');

export interface ArchitectureAnalyzerOptions {
  graph: DependencyGraph;
  files?: FileInfo[];
  config?: ArchitectureConfig;
  projectRoot?: string;
}

export class ArchitectureAnalyzer {
  private graph: DependencyGraph;
  private files: FileInfo[];
  private config: ArchitectureConfig;
  private projectRoot?: string;

  constructor(options: ArchitectureAnalyzerOptions) {
    this.graph = options.graph;
    this.files = options.files || [];
    this.config = options.config || {
      type: 'auto',
      layers: {},
      bounded_contexts: {},
      rules: { allow: [], disallow: [], enforce_public_api: true },
    };
    this.projectRoot = options.projectRoot;
  }

  analyze(): ArchitectureReport {
    const layers = this.resolveLayers();
    const boundedContexts = this.resolveBoundedContexts();
    const violations: ArchitectureViolation[] = [];

    const fileLayerMap = new Map<string, ArchitectureLayer>();
    const fileContextMap = new Map<string, BoundedContext>();

    const allFilePaths = this.getAllFilePaths();

    for (const filePath of allFilePaths) {
      const normalized = this.normalizePath(filePath);

      for (const layer of layers) {
        if (this.matchesPatterns(normalized, layer.patterns)) {
          fileLayerMap.set(normalized, layer);
          if (!layer.files) layer.files = [];
          layer.files.push(normalized);
          break;
        }
      }

      for (const ctx of boundedContexts) {
        if (this.matchesPatterns(normalized, ctx.patterns)) {
          fileContextMap.set(normalized, ctx);
          ctx.files.push(normalized);
          break;
        }
      }
    }

    for (const sourceNode of this.graph.getAllNodes()) {
      const normalizedSource = this.normalizePath(sourceNode);
      const sourceLayer = fileLayerMap.get(normalizedSource);
      const sourceContext = fileContextMap.get(normalizedSource);

      const directDeps = this.graph.getDirectDependencies(sourceNode);

      for (const dep of directDeps) {
        const normalizedTarget = this.normalizePath(dep.target);
        const targetLayer = fileLayerMap.get(normalizedTarget);
        const targetContext = fileContextMap.get(normalizedTarget);

        if (sourceLayer && targetLayer && sourceLayer.name !== targetLayer.name) {
          const layerViolation = this.checkLayerViolation(
            normalizedSource,
            normalizedTarget,
            sourceLayer,
            targetLayer,
            dep.symbols,
          );
          if (layerViolation) {
            violations.push(layerViolation);
          }
        }

        if (
          sourceContext &&
          targetContext &&
          sourceContext.name !== targetContext.name &&
          this.config.rules?.enforce_public_api
        ) {
          const contextViolation = this.checkBoundedContextViolation(
            normalizedSource,
            normalizedTarget,
            sourceContext,
            targetContext,
            dep.symbols,
          );
          if (contextViolation) {
            violations.push(contextViolation);
          }
        }
      }
    }

    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    for (const v of violations) {
      if (v.severity === 'CRITICAL') critical++;
      else if (v.severity === 'HIGH') high++;
      else if (v.severity === 'MEDIUM') medium++;
      else low++;
    }

    const totalViolations = violations.length;
    const totalFiles = allFilePaths.length || 1;
    const penalty = Math.min(
      100,
      Math.round(((critical * 20 + high * 10 + medium * 5 + low * 2) / totalFiles) * 50),
    );
    const cleanScore = Math.max(0, 100 - (totalViolations === 0 ? 0 : Math.max(10, penalty)));

    const report: ArchitectureReport = {
      architectureType: this.config.type || 'layered',
      layers,
      boundedContexts,
      violations,
      summary: {
        totalViolations,
        critical,
        high,
        medium,
        low,
        cleanScore,
      },
    };

    logger.info(
      `Architecture analysis complete: ${totalViolations} violations found (${critical} critical, ${high} high), clean score: ${cleanScore}/100`,
    );

    return report;
  }

  private resolveLayers(): ArchitectureLayer[] {
    const configuredLayers = this.config.layers || {};
    const layerNames = Object.keys(configuredLayers);

    if (layerNames.length > 0) {
      return layerNames.map((name) => {
        const rawPattern = configuredLayers[name]!;
        const patterns = Array.isArray(rawPattern) ? rawPattern : [rawPattern];
        return {
          name,
          patterns,
          type: this.inferLayerType(name),
          files: [],
        };
      });
    }

    return [
      {
        name: 'presentation',
        type: 'presentation',
        patterns: [
          '**/controllers/**',
          '**/controller/**',
          '**/routes/**',
          '**/route/**',
          '**/views/**',
          '**/pages/**',
          '**/components/**',
          '**/handlers/**',
          '**/api/**',
          '**/web/**',
          '**/*.controller.*',
          '**/*.route.*',
          '**/*.handler.*',
        ],
        files: [],
      },
      {
        name: 'application',
        type: 'application',
        patterns: [
          '**/services/**',
          '**/service/**',
          '**/usecases/**',
          '**/use-cases/**',
          '**/commands/**',
          '**/queries/**',
          '**/workflows/**',
          '**/*.service.*',
          '**/*.usecase.*',
        ],
        files: [],
      },
      {
        name: 'domain',
        type: 'domain',
        patterns: [
          '**/domain/**',
          '**/models/**',
          '**/model/**',
          '**/entities/**',
          '**/entity/**',
          '**/aggregates/**',
          '**/value-objects/**',
          '**/*.model.*',
          '**/*.entity.*',
        ],
        files: [],
      },
      {
        name: 'infrastructure',
        type: 'infrastructure',
        patterns: [
          '**/infra/**',
          '**/infrastructure/**',
          '**/repositories/**',
          '**/repository/**',
          '**/repos/**',
          '**/database/**',
          '**/db/**',
          '**/storage/**',
          '**/adapters/**',
          '**/*.repository.*',
          '**/*.repo.*',
          '**/*.adapter.*',
        ],
        files: [],
      },
      {
        name: 'shared',
        type: 'shared',
        patterns: [
          '**/shared/**',
          '**/common/**',
          '**/utils/**',
          '**/util/**',
          '**/helpers/**',
          '**/core/**',
          '**/types/**',
        ],
        files: [],
      },
    ];
  }

  private resolveBoundedContexts(): BoundedContext[] {
    const configuredContexts = this.config.bounded_contexts || {};
    const contextNames = Object.keys(configuredContexts);

    if (contextNames.length > 0) {
      return contextNames.map((name) => {
        const rawPattern = configuredContexts[name]!;
        const patterns = Array.isArray(rawPattern) ? rawPattern : [rawPattern];
        return {
          name,
          patterns,
          files: [],
        };
      });
    }

    const discoveredContexts: Map<string, string[]> = new Map();
    const allFiles = this.getAllFilePaths();

    for (const filePath of allFiles) {
      const normalized = this.normalizePath(filePath);

      const match = normalized.match(
        /(?:packages|apps|src\/modules|src\/domains|src\/features|src\/contexts)\/([^/]+)/i,
      );

      if (match && match[1]) {
        const contextName = match[1];
        if (!discoveredContexts.has(contextName)) {
          discoveredContexts.set(contextName, [`**/${contextName}/**`]);
        }
      }
    }

    return Array.from(discoveredContexts.entries()).map(([name, patterns]) => ({
      name,
      patterns,
      files: [],
    }));
  }

  private checkLayerViolation(
    sourceFile: string,
    targetFile: string,
    sourceLayer: ArchitectureLayer,
    targetLayer: ArchitectureLayer,
    symbols: string[] = [],
  ): ArchitectureViolation | null {
    const allowRules = this.config.rules?.allow || [];
    const disallowRules = this.config.rules?.disallow || [];

    const ruleKey = `${sourceLayer.name} -> ${targetLayer.name}`.toLowerCase();

    for (const disallow of disallowRules) {
      const normalizedDisallow = disallow.toLowerCase().trim();
      if (
        normalizedDisallow === ruleKey ||
        normalizedDisallow === `${sourceLayer.name} -> *`.toLowerCase()
      ) {
        return {
          id: `rule_disallow_${sourceFile}_${targetFile}`,
          sourceFile,
          targetFile,
          sourceLayer: sourceLayer.name,
          targetLayer: targetLayer.name,
          violationType: 'CUSTOM_RULE_VIOLATION',
          severity: 'HIGH',
          rule: `Disallowed dependency: ${sourceLayer.name} -> ${targetLayer.name}`,
          description: `Module '${sourceFile}' in layer '${sourceLayer.name}' explicitly forbidden from depending on '${targetFile}' in layer '${targetLayer.name}'.`,
          remediation: `Remove direct dependency from '${sourceFile}' to '${targetFile}'. Use an authorized intermediary layer or dependency injection.`,
          importedSymbols: symbols,
        };
      }
    }

    if (allowRules.length > 0) {
      const isAllowed = allowRules.some((rule) => {
        const normalized = rule.toLowerCase().trim();
        return (
          normalized === ruleKey ||
          normalized === `${sourceLayer.name} -> *`.toLowerCase() ||
          normalized === `* -> ${targetLayer.name}`.toLowerCase()
        );
      });

      if (!isAllowed && sourceLayer.name !== 'shared' && targetLayer.name !== 'shared') {
        return {
          id: `rule_not_allowed_${sourceFile}_${targetFile}`,
          sourceFile,
          targetFile,
          sourceLayer: sourceLayer.name,
          targetLayer: targetLayer.name,
          violationType: 'LAYER_REGRESSION',
          severity: 'MEDIUM',
          rule: `Unapproved layer transition: ${sourceLayer.name} -> ${targetLayer.name}`,
          description: `Layer '${sourceLayer.name}' is not authorized to depend on layer '${targetLayer.name}' according to configured architecture rules.`,
          remediation: `Route the request through an approved architectural layer or update [architecture.rules.allow] in .atlas/config.toml.`,
          importedSymbols: symbols,
        };
      }
      return null;
    }

    const sType = sourceLayer.type || 'custom';
    const tType = targetLayer.type || 'custom';

    if (sType === 'presentation' && tType === 'infrastructure') {
      return {
        id: `regression_presentation_to_infra_${sourceFile}_${targetFile}`,
        sourceFile,
        targetFile,
        sourceLayer: sourceLayer.name,
        targetLayer: targetLayer.name,
        violationType: 'LAYER_REGRESSION',
        severity: 'HIGH',
        rule: 'Layer Bypass: Presentation must not depend directly on Infrastructure',
        description: `Presentation component '${sourceFile}' directly accesses Infrastructure component '${targetFile}'. This bypasses the Application / Service layer.`,
        remediation: `Inject or call an Application Service (e.g. in 'src/services/') instead of directly accessing the database/repository.`,
        importedSymbols: symbols,
      };
    }

    if (sType === 'domain' && tType === 'infrastructure') {
      return {
        id: `regression_domain_to_infra_${sourceFile}_${targetFile}`,
        sourceFile,
        targetFile,
        sourceLayer: sourceLayer.name,
        targetLayer: targetLayer.name,
        violationType: 'LAYER_REGRESSION',
        severity: 'CRITICAL',
        rule: 'Dependency Inversion Violation: Domain must not depend on Infrastructure',
        description: `Domain entity '${sourceFile}' imports Infrastructure implementation '${targetFile}'. Domain models must remain pure and free from database/I/O details.`,
        remediation: `Define a repository interface in the Domain layer and implement it in the Infrastructure layer.`,
        importedSymbols: symbols,
      };
    }

    if (sType === 'domain' && (tType === 'application' || tType === 'presentation')) {
      return {
        id: `regression_domain_outward_${sourceFile}_${targetFile}`,
        sourceFile,
        targetFile,
        sourceLayer: sourceLayer.name,
        targetLayer: targetLayer.name,
        violationType: 'LAYER_REGRESSION',
        severity: 'CRITICAL',
        rule: 'Clean Architecture Violation: Domain must not depend on Outer Layers',
        description: `Domain component '${sourceFile}' imports '${tType}' component '${targetFile}'. Inner architectural rings must never depend on outer rings.`,
        remediation: `Refactor the shared logic into the Domain layer or pass required data into Domain methods as arguments.`,
        importedSymbols: symbols,
      };
    }

    if (sType === 'application' && tType === 'presentation') {
      return {
        id: `regression_app_to_presentation_${sourceFile}_${targetFile}`,
        sourceFile,
        targetFile,
        sourceLayer: sourceLayer.name,
        targetLayer: targetLayer.name,
        violationType: 'LAYER_REGRESSION',
        severity: 'HIGH',
        rule: 'Inverted Dependency: Application layer must not import Presentation layer',
        description: `Service '${sourceFile}' imports Presentation module '${targetFile}'. Services should be decoupled from delivery mechanisms.`,
        remediation: `Remove controller/view references from the application service.`,
        importedSymbols: symbols,
      };
    }

    return null;
  }

  private checkBoundedContextViolation(
    sourceFile: string,
    targetFile: string,
    sourceContext: BoundedContext,
    targetContext: BoundedContext,
    symbols: string[] = [],
  ): ArchitectureViolation | null {
    const isPublicApi = this.isPublicApiFile(targetFile);

    if (!isPublicApi) {
      return {
        id: `public_api_bypass_${sourceFile}_${targetFile}`,
        sourceFile,
        targetFile,
        sourceContext: sourceContext.name,
        targetContext: targetContext.name,
        violationType: 'PUBLIC_API_BYPASS',
        severity: 'HIGH',
        rule: 'Encapsulation Violation: Bounded context accessed via internal private path',
        description: `Module '${sourceFile}' in context '${sourceContext.name}' imports internal file '${targetFile}' from context '${targetContext.name}' instead of its public API.`,
        remediation: `Export '${symbols.join(', ') || 'required symbols'}' from the public entry point of '${targetContext.name}' (e.g. index.ts) and import from the root module.`,
        importedSymbols: symbols,
      };
    }

    return null;
  }

  private isPublicApiFile(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    const fileName = normalized.split('/').pop() || '';

    if (
      fileName === 'index.ts' ||
      fileName === 'index.js' ||
      fileName === 'public-api.ts' ||
      fileName === 'public-api.js' ||
      fileName === 'api.ts' ||
      fileName === 'api.js' ||
      fileName === 'main.ts' ||
      fileName === 'main.js'
    ) {
      return true;
    }

    if (
      normalized.includes('/internal/') ||
      normalized.includes('/private/') ||
      normalized.includes('/_') ||
      fileName.startsWith('_')
    ) {
      return false;
    }

    return false;
  }

  private inferLayerType(name: string): ArchitectureLayerType {
    const n = name.toLowerCase();
    if (
      n.includes('controller') ||
      n.includes('route') ||
      n.includes('view') ||
      n.includes('page') ||
      n.includes('presentation') ||
      n.includes('api') ||
      n.includes('web')
    ) {
      return 'presentation';
    }
    if (
      n.includes('service') ||
      n.includes('usecase') ||
      n.includes('application') ||
      n.includes('handler') ||
      n.includes('workflow')
    ) {
      return 'application';
    }
    if (
      n.includes('domain') ||
      n.includes('model') ||
      n.includes('entity') ||
      n.includes('aggregate')
    ) {
      return 'domain';
    }
    if (
      n.includes('infra') ||
      n.includes('repo') ||
      n.includes('database') ||
      n.includes('storage') ||
      n.includes('adapter')
    ) {
      return 'infrastructure';
    }
    if (n.includes('shared') || n.includes('common') || n.includes('util') || n.includes('core')) {
      return 'shared';
    }
    return 'custom';
  }

  private getAllFilePaths(): string[] {
    if (this.files.length > 0) {
      return this.files.map((f) => f.relativePath || f.path);
    }
    return Array.from(this.graph.getAllNodes());
  }

  private normalizePath(filePath: string): string {
    let p = filePath.replace(/\\/g, '/');
    if (this.projectRoot) {
      const normalizedRoot = this.projectRoot.replace(/\\/g, '/');
      if (p.startsWith(normalizedRoot)) {
        p = p.slice(normalizedRoot.length);
        if (p.startsWith('/')) p = p.slice(1);
      }
    }
    return p;
  }

  private matchesPatterns(filePath: string, patterns: string[]): boolean {
    const normalized = filePath.toLowerCase();
    for (const pattern of patterns) {
      const p = pattern.replace(/\\/g, '/').toLowerCase();

      if (p.startsWith('**/') && p.endsWith('/**')) {
        const keyword = p.slice(3, -3);
        if (normalized.includes(`/${keyword}/`) || normalized.startsWith(`${keyword}/`)) {
          return true;
        }
      }

      if (p.startsWith('**/*.') && p.endsWith('.*')) {
        const middle = p.slice(5, -2);
        if (normalized.includes(`.${middle}.`)) {
          return true;
        }
      }

      const cleanP = p
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^\/+|\/+$/g, '');
      if (cleanP && normalized.includes(cleanP)) {
        return true;
      }
    }
    return false;
  }
}

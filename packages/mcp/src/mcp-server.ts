import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';
import type {
  FileInfo,
  ProjectMeta,
  ContextFile,
  ContextMode,
  Language,
  Framework,
  PackageManager,
  RetrievalIntent,
} from '@codeatlas-ai/core';
import { defaultConfig, detectLanguage, redactSecrets } from '@codeatlas-ai/core';
import {
  AtlasDatabase,
  runMigrations,
  FileRepository,
  SymbolRepository,
  DependencyRepository,
  SearchRepository,
  ProjectRepository,
  EmbeddingRepository,
  FederationService,
} from '@codeatlas-ai/storage';
import { Scanner, Indexer } from '@codeatlas-ai/indexer';
import {
  DependencyGraph,
  GraphQueryEngine,
  type GraphNodeItem,
  type GraphEdgeItem,
} from '@codeatlas-ai/graph';
import { RetrievalEngine } from '@codeatlas-ai/retrieval';
import { Ranker } from '@codeatlas-ai/ranking';
import { ContextEngine } from '@codeatlas-ai/context';
import { RuleEngine } from '@codeatlas-ai/rules';
import { GitService } from '@codeatlas-ai/git';
import { CodeCompressor } from '@codeatlas-ai/compression';
import { CodebaseAnalyzer, TaintAnalyzer } from '@codeatlas-ai/analytics';
import { NaturalLanguageToCypher } from '@codeatlas-ai/nl2cypher';
import { validateSourceCode } from '@codeatlas-ai/parser';
import { createEmbeddingProvider, cosineSimilarity } from '@codeatlas-ai/llm';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export class McpServer {
  private rootDir: string;
  private dbPath: string;
  private dbInstance: { db: AtlasDatabase; projectId: number } | null = null;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = path.resolve(rootDir);
    this.dbPath = path.join(this.rootDir, '.atlas', 'atlas.db');
  }

  public getTools(): McpTool[] {
    return [
      {
        name: 'atlas_scan',
        description:
          'Scan repository to detect languages, frameworks, workspaces, and project architecture.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'atlas_index',
        description:
          'Build or incrementally update CodeAtlas AST symbols, imports, and dependency graph.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'atlas_search',
        description:
          'Full-text, symbol, and semantic vector search across the codebase using SQLite FTS5 BM25 and embeddings.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search term, symbol name, or natural language keywords',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 20)',
            },
            semantic: {
              type: 'boolean',
              description: 'Enable semantic vector embedding similarity matching',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'atlas_get_context',
        description:
          'Retrieve and pack token-budgeted, explainable code context relevant to a specific coding task.',
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'Description of the coding task or feature to implement',
            },
            maxTokens: { type: 'number', description: 'Total token budget (default: 12000)' },
            mode: {
              type: 'string',
              description:
                'Context packing mode: full, signature, summary, or digest (default: full)',
            },
            intent: {
              type: 'string',
              description:
                'Task intent for task-aware dynamic retrieval weighting: bug, feature, refactor, or explore (default: explore)',
            },
          },
          required: ['task'],
        },
      },
      {
        name: 'atlas_graph_query',
        description:
          'Execute Cypher-like graph query over the AST and dependency graph (e.g. MATCH (f:File)-[:IMPORTS]->(t:File) RETURN f, t).',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Cypher query string' },
          },
          required: ['query'],
        },
      },
      {
        name: 'atlas_pr_diff',
        description:
          'Analyze Pull Request / Git branch diff with architectural impact, affected modules, and unified diff.',
        inputSchema: {
          type: 'object',
          properties: {
            baseBranch: {
              type: 'string',
              description: 'Base git branch to compare against (default: main)',
            },
          },
        },
      },
      {
        name: 'atlas_compress',
        description:
          'Compress code file into signature skeletons and interface contracts to save token budget.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Relative path of file to compress' },
            maxBudgetTokens: { type: 'number', description: 'Maximum token budget for this file' },
          },
          required: ['filePath'],
        },
      },
      {
        name: 'atlas_get_map',
        description: 'Retrieve the hierarchical codebase structural map with exported symbols.',
        inputSchema: {
          type: 'object',
          properties: {
            depth: { type: 'number', description: 'Maximum directory depth (default: 3)' },
          },
        },
      },
      {
        name: 'atlas_get_rules',
        description:
          'Discover and validate AI coding agent rules (AGENTS.md, CLAUDE.md, Cursor, etc.).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'atlas_doctor',
        description: 'Run health diagnostics on repository indexing and context readiness.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'atlas_analyze',
        description:
          'Analyze codebase graph architecture for dead code, circular dependencies, and complexity hotspots.',
        inputSchema: {
          type: 'object',
          properties: {
            cycles: { type: 'boolean', description: 'Only check for circular dependencies' },
            deadCode: { type: 'boolean', description: 'Only check for dead / unreferenced code' },
            hotspots: { type: 'boolean', description: 'Only check for high coupling hotspots' },
          },
        },
      },
      {
        name: 'atlas_sql_query',
        description:
          'Execute a read-only SQL query directly against the CodeAtlas SQLite database (.atlas/atlas.db) to query projects, files, symbols, dependencies, and search indices.',
        inputSchema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description:
                'Read-only SQL query string (e.g. SELECT name, kind, line FROM symbols WHERE kind = "class" LIMIT 50)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of rows to return (default: 100, max: 500)',
            },
          },
          required: ['sql'],
        },
      },
      {
        name: 'atlas_apply_refactor',
        description:
          'Safely apply code changes or refactorings with automatic Tree-Sitter AST syntax error validation before writing to disk.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Relative path of the file to modify or create',
            },
            newContent: {
              type: 'string',
              description: 'The updated full content of the file',
            },
          },
          required: ['filePath', 'newContent'],
        },
      },
      {
        name: 'atlas_fix_circular_dependency',
        description:
          'Analyze an existing circular dependency loop and get architectural decoupling recommendations.',
        inputSchema: {
          type: 'object',
          properties: {
            cyclePath: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of file paths forming the cycle (e.g. ["a.ts", "b.ts", "a.ts"])',
            },
          },
          required: ['cyclePath'],
        },
      },
      {
        name: 'atlas_security_audit',
        description:
          'Perform automated Static Application Security Testing (SAST) and Data-Flow Taint Analysis across the repository to detect SQL Injection, Command Injection, Code Injection, Path Traversal, and XSS risks.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description:
                'Optional relative file path to audit. If omitted, audits the entire codebase.',
            },
          },
        },
      },
      {
        name: 'atlas_federate_repo',
        description:
          'Attach an external workspace repository to the active CodeAtlas database connection using SQLite native ATTACH DATABASE for cross-repository symbol and dependency queries.',
        inputSchema: {
          type: 'object',
          properties: {
            repoPath: {
              type: 'string',
              description:
                'Absolute or relative path to the target repository root containing .atlas/atlas.db',
            },
            alias: {
              type: 'string',
              description: 'Optional custom schema alias name (e.g. "backend" or "frontend")',
            },
          },
          required: ['repoPath'],
        },
      },
      {
        name: 'atlas_plan_feature',
        description:
          'Autonomous feature planning agent tool: orchestrates hybrid search, dependency graph expansion, and rule checking to generate an optimal architectural roadmap and candidate files for implementing a new feature or fix.',
        inputSchema: {
          type: 'object',
          properties: {
            feature: {
              type: 'string',
              description: 'Detailed description of the feature or bugfix to plan',
            },
            maxFiles: {
              type: 'number',
              description: 'Maximum number of candidate files to include in the plan (default: 15)',
            },
          },
          required: ['feature'],
        },
      },
      {
        name: 'atlas_detect_dead_code',
        description:
          'Detect unreferenced files and orphan exported symbols (dead code) across the repository graph with actionable remediation hints.',
        inputSchema: {
          type: 'object',
          properties: {
            ignoreTestFiles: {
              type: 'boolean',
              description: 'Whether to ignore test files (default: true)',
            },
          },
        },
      },
      {
        name: 'atlas_complexity_report',
        description:
          'Analyze and rank code symbols by Cyclomatic Complexity to identify technical debt, refactoring candidates, and complex functions.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of top complex symbols to return (default: 15)',
            },
          },
        },
      },
      {
        name: 'atlas_trace_execution_path',
        description:
          'Find and trace the exact execution/dependency path between two files/modules in the codebase with step-by-step confidence scores and resolution types.',
        inputSchema: {
          type: 'object',
          properties: {
            fromNode: {
              type: 'string',
              description: 'Source relative file path (e.g. "packages/indexer/src/indexer.ts")',
            },
            toNode: {
              type: 'string',
              description: 'Target relative file path (e.g. "packages/storage/src/repositories.ts")',
            },
          },
          required: ['fromNode', 'toNode'],
        },
      },
      {
        name: 'atlas_find_entry_points',
        description:
          'Discover all top-level entry points and ingress modules (controllers, routes, CLI commands, main apps) that invoke or depend on the specified target file.',
        inputSchema: {
          type: 'object',
          properties: {
            targetNode: {
              type: 'string',
              description: 'Relative path of the target file/module to trace entry points for',
            },
            maxDepth: {
              type: 'number',
              description: 'Maximum backward traversal depth (default: 10)',
            },
          },
          required: ['targetNode'],
        },
      },
      {
        name: 'atlas_calculate_change_surface',
        description:
          'Calculate the complete blast radius, downstream impact surface, risk vulnerability score, and recommended test files for modifying specified files.',
        inputSchema: {
          type: 'object',
          properties: {
            filePaths: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of relative file paths proposed to be modified or refactored',
            },
            maxDepth: {
              type: 'number',
              description: 'Maximum blast radius traversal depth (default: 5)',
            },
          },
          required: ['filePaths'],
        },
      },
    ];
  }

  public getResources(): McpResource[] {
    return [
      {
        uri: 'atlas://architecture/map',
        name: 'Codebase Architecture Map',
        description: 'Structural overview of files, modules, and exported symbols',
        mimeType: 'application/json',
      },
      {
        uri: 'atlas://architecture/rules',
        name: 'AI Agent Coding Rules',
        description: 'Discovered guidelines from AGENTS.md, CLAUDE.md, .cursorrules',
        mimeType: 'application/json',
      },
      {
        uri: 'atlas://architecture/graph',
        name: 'Dependency Graph Topology',
        description: 'Topological dependency edges and module coupling counts',
        mimeType: 'application/json',
      },
    ];
  }

  public getPrompts(): McpPrompt[] {
    return [
      {
        name: 'explain_codebase',
        description: 'Generate high-level architectural walkthrough of this repository',
        arguments: [],
      },
      {
        name: 'plan_feature',
        description:
          'Generate an implementation plan for a new feature with relevant codebase context',
        arguments: [
          {
            name: 'task',
            description: 'Description of feature to implement',
            required: true,
          },
        ],
      },
      {
        name: 'review_pr',
        description: 'Perform an AI architectural review of current PR branch changes',
        arguments: [
          {
            name: 'baseBranch',
            description: 'Base branch name (default: main)',
            required: false,
          },
        ],
      },
    ];
  }

  public async handleMessage(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    const id = req.id ?? null;

    try {
      switch (req.method) {
        case 'initialize': {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
                resources: {},
                prompts: {},
                logging: {},
              },
              serverInfo: {
                name: 'codeatlas-mcp',
                version: '0.2.0',
              },
            },
          };
        }

        case 'notifications/initialized':
        case 'initialized': {
          return null;
        }

        case 'ping': {
          return {
            jsonrpc: '2.0',
            id,
            result: {},
          };
        }

        case 'tools/list': {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              tools: this.getTools(),
            },
          };
        }

        case 'resources/list': {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              resources: this.getResources(),
            },
          };
        }

        case 'resources/read': {
          const params = req.params as { uri?: string } | undefined;
          const uri = params?.uri;
          if (!uri) {
            return {
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: 'Missing uri parameter' },
            };
          }

          const content = await this.readResource(uri);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: content,
                },
              ],
            },
          };
        }

        case 'prompts/list': {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              prompts: this.getPrompts(),
            },
          };
        }

        case 'prompts/get': {
          const params = req.params as
            { name?: string; arguments?: Record<string, string> } | undefined;
          const promptName = params?.name;
          const args = params?.arguments ?? {};

          if (!promptName) {
            return {
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: 'Missing prompt name' },
            };
          }

          const promptResult = await this.getPrompt(promptName, args);
          return {
            jsonrpc: '2.0',
            id,
            result: promptResult,
          };
        }

        case 'tools/call': {
          const params = req.params as
            { name?: string; arguments?: Record<string, unknown> } | undefined;
          const toolName = params?.name;
          const args = params?.arguments ?? {};

          if (!toolName) {
            return {
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: 'Missing tool name' },
            };
          }

          const resultText = await this.executeTool(toolName, args);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: resultText,
                },
              ],
            },
          };
        }

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${req.method}`,
            },
          };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: `Internal error: ${msg}`,
        },
      };
    }
  }

  private openDb(): { db: AtlasDatabase; projectId: number } {
    if (this.dbInstance) {
      return this.dbInstance;
    }

    const atlasDir = path.join(this.rootDir, '.atlas');
    if (!fs.existsSync(atlasDir)) {
      fs.mkdirSync(atlasDir, { recursive: true });
    }
    const db = new AtlasDatabase(this.dbPath);
    runMigrations(db);

    const normalizedRoot = this.rootDir.replace(/\\/g, '/');
    let project = db.get<{ id: number }>('SELECT id FROM projects WHERE root = ?', normalizedRoot);
    if (!project) {
      const name = path.basename(this.rootDir);
      const res = db.run('INSERT INTO projects (name, root) VALUES (?, ?)', name, normalizedRoot);
      project = { id: Number(res.lastInsertRowid) };
    }

    this.dbInstance = { db, projectId: project.id };
    return this.dbInstance;
  }

  public close(): void {
    if (this.dbInstance) {
      try {
        this.dbInstance.db.close();
      } catch {
        // Ignore
      }
      this.dbInstance = null;
    }
  }

  public async readResource(uri: string): Promise<string> {
    switch (uri) {
      case 'atlas://architecture/map': {
        const { db, projectId } = this.openDb();
        const fileRepo = new FileRepository(db);
        const files = fileRepo.getAll(projectId);
        return JSON.stringify(
          {
            root: this.rootDir,
            fileCount: files.length,
            files: files.map((f: FileInfo) => f.relativePath),
          },
          null,
          2,
        );
      }

      case 'atlas://architecture/rules': {
        const ruleEngine = new RuleEngine(this.rootDir);
        const rules = ruleEngine.discover();
        return JSON.stringify({ rules }, null, 2);
      }

      case 'atlas://architecture/graph': {
        const { db, projectId } = this.openDb();
        const depRepo = new DependencyRepository(db);
        const deps = depRepo.getAll(projectId);
        return JSON.stringify(
          { totalDependencies: deps.length, edges: deps.slice(0, 100) },
          null,
          2,
        );
      }

      default:
        throw new Error(`Resource not found: ${uri}`);
    }
  }

  public async getPrompt(
    name: string,
    args: Record<string, string>,
  ): Promise<{
    description?: string;
    messages: Array<{ role: string; content: { type: string; text: string } }>;
  }> {
    switch (name) {
      case 'explain_codebase': {
        const scanner = new Scanner({ root: this.rootDir });
        const scanResult = await scanner.scan();
        const ruleEngine = new RuleEngine(this.rootDir);
        const rules = ruleEngine.discover();

        return {
          description: 'High-level codebase architecture walkthrough',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `You are an expert software architect. Analyze this codebase:\n\nProject Structure:\n${JSON.stringify(scanResult, null, 2)}\n\nDiscovered Rules:\n${JSON.stringify(rules, null, 2)}\n\nPlease provide a clear architecture overview, key modules, entry points, and coding conventions.`,
              },
            },
          ],
        };
      }

      case 'plan_feature': {
        const task = args['task'] ?? 'New Feature';
        const contextJson = await this.executeTool('atlas_get_context', { task, maxTokens: 8000 });

        return {
          description: `Feature implementation plan for "${task}"`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `You are an expert pair programmer. Create a step-by-step implementation plan for the following task:\n\nTask: ${task}\n\nCodebase Context:\n${contextJson}\n\nPlease outline affected files, proposed modifications, test strategy, and verification steps.`,
              },
            },
          ],
        };
      }

      case 'review_pr': {
        const baseBranch = args['baseBranch'] ?? 'main';
        const prDiffJson = await this.executeTool('atlas_pr_diff', { baseBranch });

        return {
          description: `Pull Request review against ${baseBranch}`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `You are a senior code reviewer. Review the following Pull Request changes:\n\nPR Analysis:\n${prDiffJson}\n\nCheck for architecture compliance, breaking changes, potential bugs, test coverage, and code quality.`,
              },
            },
          ],
        };
      }

      default:
        throw new Error(`Prompt not found: ${name}`);
    }
  }

  public async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    switch (name) {
      case 'atlas_scan': {
        const scanner = new Scanner({ root: this.rootDir });
        const scanResult = await scanner.scan();
        return JSON.stringify(scanResult, null, 2);
      }

      case 'atlas_index': {
        const { db, projectId } = this.openDb();
        const indexer = new Indexer({ root: this.rootDir, db, projectId });
        const stats = await indexer.index();
        return JSON.stringify(stats, null, 2);
      }

      case 'atlas_search': {
        const query = String(args.query ?? '');
        const limit = typeof args.limit === 'number' ? args.limit : 20;
        const semantic = Boolean(args.semantic);
        const { db, projectId } = this.openDb();
        const searchRepo = new SearchRepository(db);
        const ftsResults = searchRepo.searchFiles(query, limit);

        if (!semantic) {
          return JSON.stringify(ftsResults, null, 2);
        }

        const embeddingRepo = new EmbeddingRepository(db);
        const embeddingProvider = createEmbeddingProvider();
        const queryVector = await embeddingProvider.generateEmbedding(query);
        const allEmbeddings = embeddingRepo.getAll(projectId);

        const semanticMatches = allEmbeddings
          .map((record) => {
            const similarity = cosineSimilarity(queryVector, record.embedding);
            return {
              filePath: record.filePath,
              symbolName: record.symbolName,
              similarity,
              model: record.model,
            };
          })
          .filter((m) => m.similarity > 0.1)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);

        return JSON.stringify(
          {
            lexicalResults: ftsResults,
            semanticResults: semanticMatches,
          },
          null,
          2,
        );
      }

      case 'atlas_get_context': {
        const task = String(args.task ?? '');
        const budget = typeof args.maxTokens === 'number' ? args.maxTokens : 12000;
        const rawMode = String(args.mode ?? 'full');
        const mode: ContextMode =
          rawMode === 'signature' || rawMode === 'summary' || rawMode === 'digest'
            ? rawMode
            : 'full';

        const { db, projectId } = this.openDb();

        const fileRepo = new FileRepository(db);
        const depRepo = new DependencyRepository(db);
        const searchRepo = new SearchRepository(db);
        const projectRepo = new ProjectRepository(db);

        const files = fileRepo.getAll(projectId);
        const filesByPath = new Map<string, FileInfo>(
          files.map((f: FileInfo) => [f.relativePath, f]),
        );
        const deps = depRepo.getAll(projectId);

        const graph = new DependencyGraph();
        graph.addEdges(deps);

        const intent = (args.intent as RetrievalIntent) || undefined;
        const retrieval = new RetrievalEngine(searchRepo, graph, filesByPath);
        const retrievalResult = retrieval.retrieve(task, { limit: 50, intent });

        const config = defaultConfig();
        const ranker = new Ranker({
          weights: config.ranking,
          queryTerms: retrievalResult.queryTerms,
        });
        const ranked = ranker.rank(retrievalResult.candidates);

        const ruleEngine = new RuleEngine(this.rootDir);
        const rules = ruleEngine.discover();

        const projectRecord = projectRepo.getById(projectId);

        const projectMeta: ProjectMeta = {
          name: projectRecord?.name || path.basename(this.rootDir),
          root: this.rootDir.replace(/\\/g, '/'),
          languages: (projectRecord?.languages as Language[]) || ['typescript'],
          frameworks: (projectRecord?.frameworks as Framework[]) || [],
          packageManager: (projectRecord?.packageManager as PackageManager) || 'pnpm',
          fileCount: files.length,
          symbolCount: 0,
          dependencyCount: deps.length,
          isMonorepo: projectRecord?.isMonorepo ?? false,
          workspaces: projectRecord?.workspaces || [],
        };

        const contextEngine = new ContextEngine({
          tokenBudget: budget,
          defaultMode: mode,
          repositoryRoot: this.rootDir,
        });

        const pack = contextEngine.build({
          task,
          project: projectMeta,
          rankedResults: ranked,
          rules,
        });

        return JSON.stringify(
          {
            task: pack.task,
            tokenUsage: pack.tokenUsage,
            tokenBudget: pack.tokenBudget,
            tokenBreakdown: pack.tokenBreakdown,
            fileCount: pack.files.length,
            files: pack.files.map((f: ContextFile) => ({
              path: f.relativePath,
              language: f.language,
              relevance: f.relevance,
              mode: f.mode,
              tokenCount: f.tokenCount,
              reasons: f.reasons,
              content: f.content,
            })),
            rules: pack.rules,
            architecture: pack.architecture,
          },
          null,
          2,
        );
      }

      case 'atlas_graph_query': {
        const queryStr = String(args.query ?? '');
        let targetQuery = queryStr;

        if (args.naturalLanguage || !queryStr.trim().toUpperCase().startsWith('MATCH')) {
          const translator = new NaturalLanguageToCypher();
          const translation = await translator.translate(queryStr);
          targetQuery = translation.query;
        }

        const { db, projectId } = this.openDb();
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
          properties: {
            weight: d.weight,
            confidence: d.confidence ?? 0.9,
            resolution: d.resolution ?? 'tree-sitter',
          },
        }));

        const graph = new DependencyGraph();
        const engine = new GraphQueryEngine(graph, nodes, edges);
        const result = engine.execute(targetQuery);

        return JSON.stringify(
          { ...result, originalQuery: queryStr, executedCypher: targetQuery },
          null,
          2,
        );
      }

      case 'atlas_pr_diff': {
        const baseBranch = String(args.baseBranch ?? 'main');
        const git = new GitService(this.rootDir);
        const changedFiles = git.getBranchChangedFiles(baseBranch);
        const recentCommits = git.getRecentCommits(5);
        const diffContent = git.getBranchDiff(baseBranch);

        const { db, projectId } = this.openDb();
        const depRepo = new DependencyRepository(db);
        const deps = depRepo.getAll(projectId);
        const graph = new DependencyGraph();
        for (const d of deps) graph.addEdge(d);

        const affectedFiles = new Set<string>(changedFiles);
        for (const file of changedFiles) {
          const dependents = graph.getDependents(file, 1);
          for (const dep of dependents) affectedFiles.add(dep);
        }

        return JSON.stringify(
          {
            baseBranch,
            changedFilesCount: changedFiles.length,
            changedFiles,
            affectedFilesCount: affectedFiles.size,
            affectedFiles: Array.from(affectedFiles),
            recentCommits,
            unifiedDiff: (diffContent ?? '').slice(0, 30000),
          },
          null,
          2,
        );
      }

      case 'atlas_compress': {
        const filePath = String(args.filePath ?? '');
        const maxBudgetTokens =
          typeof args.maxBudgetTokens === 'number' ? args.maxBudgetTokens : undefined;
        const absPath = path.resolve(this.rootDir, filePath);

        if (!fs.existsSync(absPath)) {
          throw new Error(`File not found: ${filePath}`);
        }

        const rawSource = fs.readFileSync(absPath, 'utf-8');
        const source = redactSecrets(rawSource);
        const compressor = new CodeCompressor();
        const ext = path.extname(filePath);
        const lang =
          ext === '.ts' || ext === '.tsx'
            ? 'typescript'
            : ext === '.js' || ext === '.jsx'
              ? 'javascript'
              : 'typescript';
        const res = compressor.compress(source, lang, maxBudgetTokens);

        return JSON.stringify(res, null, 2);
      }

      case 'atlas_get_map': {
        const depth = typeof args.depth === 'number' ? args.depth : 3;
        const { db, projectId } = this.openDb();
        const fileRepo = new FileRepository(db);
        const files = fileRepo.getAll(projectId);

        const filtered = files
          .map((f: FileInfo) => f.relativePath)
          .filter((p: string) => p.split('/').length <= depth + 1);

        return JSON.stringify({ depth, files: filtered }, null, 2);
      }

      case 'atlas_get_rules': {
        const ruleEngine = new RuleEngine(this.rootDir);
        const rules = ruleEngine.discover();
        const conflicts = ruleEngine.detectConflicts();
        return JSON.stringify({ rules, conflicts }, null, 2);
      }

      case 'atlas_doctor': {
        const { db, projectId } = this.openDb();
        const fileRepo = new FileRepository(db);
        const symbolRepo = new SymbolRepository(db);
        const files = fileRepo.getAll(projectId);
        const symbols = symbolRepo.count();
        const ruleEngine = new RuleEngine(this.rootDir);
        const rules = ruleEngine.discover();

        return JSON.stringify(
          {
            status: 'healthy',
            indexedFiles: files.length,
            indexedSymbols: symbols,
            discoveredRules: rules.length,
            dbPath: this.dbPath,
          },
          null,
          2,
        );
      }

      case 'atlas_analyze': {
        const { db, projectId } = this.openDb();
        const analyzer = new CodebaseAnalyzer({ db, projectId });
        const report = analyzer.analyze();

        if (args.cycles) {
          return JSON.stringify({ cycles: report.cycles, count: report.cycles.length }, null, 2);
        }
        if (args.deadCode) {
          return JSON.stringify(
            { deadCode: report.deadCode, count: report.deadCode.length },
            null,
            2,
          );
        }
        if (args.hotspots) {
          return JSON.stringify(
            { hotspots: report.hotspots, instabilities: report.instabilities },
            null,
            2,
          );
        }
        return JSON.stringify(report, null, 2);
      }

      case 'atlas_sql_query': {
        const sql = String(args.sql ?? '').trim();
        if (!sql) {
          throw new Error('Missing "sql" argument');
        }

        const forbiddenPatterns =
          /\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|REPLACE|ATTACH|DETACH)\b/i;
        if (forbiddenPatterns.test(sql)) {
          throw new Error('Only read-only SELECT or PRAGMA statements are permitted.');
        }

        const limit = typeof args.limit === 'number' ? Math.min(Math.max(1, args.limit), 500) : 100;
        const { db } = this.openDb();

        let executableSql = sql.replace(/;+$/, '');
        if (!/\bLIMIT\b/i.test(executableSql)) {
          executableSql += ` LIMIT ${limit}`;
        }

        const rows = db.all<Record<string, unknown>>(executableSql);
        return JSON.stringify(
          {
            sql: executableSql,
            rowCount: rows.length,
            rows,
          },
          null,
          2,
        );
      }

      case 'atlas_apply_refactor': {
        const filePath = String(args.filePath ?? '').trim();
        const newContent = String(args.newContent ?? '');
        if (!filePath) {
          throw new Error('Missing "filePath" argument');
        }

        const absPath = path.resolve(this.rootDir, filePath);
        const language = detectLanguage(filePath);

        const validation = validateSourceCode(newContent, language);
        if (!validation.valid) {
          return JSON.stringify(
            {
              success: false,
              applied: false,
              filePath,
              message: 'Refactoring rejected: code contains AST syntax errors.',
              errors: validation.errors,
            },
            null,
            2,
          );
        }

        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, newContent, 'utf-8');

        try {
          const { db, projectId } = this.openDb();
          const indexer = new Indexer({ root: this.rootDir, db, projectId });
          await indexer.indexFiles([filePath]);
        } catch {
          // Non-blocking indexer update
        }

        return JSON.stringify(
          {
            success: true,
            applied: true,
            filePath,
            message: 'Refactoring safely validated and applied to disk.',
          },
          null,
          2,
        );
      }

      case 'atlas_fix_circular_dependency': {
        const cycle = Array.isArray(args.cyclePath) ? (args.cyclePath as string[]) : [];
        if (cycle.length < 2) {
          throw new Error('cyclePath must contain at least 2 file paths');
        }

        const suggestions = [
          `1. Extract Shared Interfaces: Create a new file (e.g. types.ts) and move shared interface/type declarations from ${cycle[0]} and ${cycle[1]} into it.`,
          `2. Dependency Inversion: Inject dependencies as constructor parameters rather than directly importing modules across the cycle.`,
          `3. Dynamic Import: Defer runtime evaluation using dynamic import() inside specific functions.`,
        ];

        return JSON.stringify(
          {
            cycle,
            recommendation:
              'Decouple cyclical dependencies via interface extraction or dependency inversion.',
            steps: suggestions,
          },
          null,
          2,
        );
      }

      case 'atlas_security_audit': {
        const filePath = typeof args.filePath === 'string' ? args.filePath.trim() : '';
        const { db, projectId } = this.openDb();
        const fileRepo = new FileRepository(db);
        let files = fileRepo.getAll(projectId);

        if (filePath) {
          files = files.filter(
            (f: FileInfo) => f.relativePath === filePath || f.path.endsWith(filePath),
          );
        }

        const taintAnalyzer = new TaintAnalyzer({ rootDir: this.rootDir, files });
        const report = taintAnalyzer.audit();

        return JSON.stringify(report, null, 2);
      }

      case 'atlas_federate_repo': {
        const repoPath = String(args.repoPath ?? '').trim();
        const alias = typeof args.alias === 'string' ? args.alias.trim() : undefined;
        if (!repoPath) {
          throw new Error('Missing "repoPath" argument');
        }

        const targetRoot = path.isAbsolute(repoPath)
          ? repoPath
          : path.resolve(this.rootDir, repoPath);
        const { db } = this.openDb();
        const federation = new FederationService(db);
        const result = federation.attachRepo(targetRoot, alias);

        return JSON.stringify(
          {
            success: true,
            attachedRepo: result,
            allAttached: federation.listFederated(),
          },
          null,
          2,
        );
      }

      case 'atlas_plan_feature': {
        const feature = String(args.feature ?? '').trim();
        const maxFiles = typeof args.maxFiles === 'number' ? args.maxFiles : 15;
        if (!feature) {
          throw new Error('Missing "feature" argument');
        }

        const { db, projectId } = this.openDb();
        const fileRepo = new FileRepository(db);
        const depRepo = new DependencyRepository(db);
        const searchRepo = new SearchRepository(db);

        const files = fileRepo.getAll(projectId);
        const filesByPath = new Map<string, FileInfo>(
          files.map((f: FileInfo) => [f.relativePath, f]),
        );
        const deps = depRepo.getAll(projectId);

        const graph = new DependencyGraph();
        graph.addEdges(deps);

        const retrievalEngine = new RetrievalEngine(searchRepo, graph, filesByPath);
        const retrievalResult = retrievalEngine.retrieve(feature, maxFiles);

        const coreFiles: string[] = retrievalResult.candidates
          .slice(0, Math.ceil(maxFiles / 2))
          .map((r) => r.filePath);
        const contextSet = new Set<string>();

        for (const file of coreFiles) {
          const directDeps = graph.getDependencies(file, 1);
          const directDependents = graph.getDependents(file, 1);
          for (const d of directDeps) contextSet.add(d);
          for (const d of directDependents) contextSet.add(d);
        }

        for (const f of coreFiles) {
          contextSet.delete(f);
        }

        const ruleEngine = new RuleEngine(this.rootDir);
        const rules = ruleEngine.discover();

        const plan = {
          feature,
          status: 'ready',
          recommendedWorkflow: [
            '1. Review architectural touchpoints and core files listed below.',
            '2. Update interfaces and core data models if needed.',
            '3. Implement business logic in target service/handler files.',
            '4. Run "atlas diff" or "atlas analyze" to verify no circular dependencies or breaking changes were introduced.',
          ],
          primaryTouchpoints: coreFiles.map((file: string) => ({
            filePath: file,
            role: 'Primary modification target',
            directDependents: graph.getDirectDependents(file).map((e) => ({
              file: e.source,
              confidence: e.confidence ?? 0.9,
              resolution: e.resolution ?? 'tree-sitter',
            })),
            directDependencies: graph.getDirectDependencies(file).map((e) => ({
              file: e.target,
              confidence: e.confidence ?? 0.9,
              resolution: e.resolution ?? 'tree-sitter',
            })),
          })),
          supportingContextFiles: Array.from(contextSet).slice(0, maxFiles),
          activeRulesCount: rules.length,
          rulesSummary: rules.slice(0, 3).map((r) => ({
            source: r.source,
            snippet: r.content.slice(0, 150) + (r.content.length > 150 ? '...' : ''),
          })),
        };

        return JSON.stringify(plan, null, 2);
      }

      case 'atlas_detect_dead_code': {
        const { db, projectId } = this.openDb();
        const analyzer = new CodebaseAnalyzer({ db, projectId, rootDir: this.rootDir });
        const deadItems = analyzer.detectDeadCode({
          ignoreTestFiles: args.ignoreTestFiles !== false,
        });

        const deadFiles = deadItems.filter((i) => i.kind === 'file');
        const deadSymbols = deadItems.filter((i) => i.kind === 'symbol');

        return JSON.stringify(
          {
            summary: {
              totalDeadItems: deadItems.length,
              deadFilesCount: deadFiles.length,
              deadSymbolsCount: deadSymbols.length,
            },
            deadFiles,
            deadSymbols,
            recommendation:
              deadItems.length > 0
                ? 'Review unreferenced files and orphan symbols for safe removal or export cleanup.'
                : 'No dead code or orphan exported symbols detected. Clean architecture!',
          },
          null,
          2,
        );
      }

      case 'atlas_complexity_report': {
        const { db, projectId } = this.openDb();
        const symbolRepo = new SymbolRepository(db);
        const limit = typeof args.limit === 'number' ? args.limit : 15;
        const topSymbols = symbolRepo.getTopComplex(limit, projectId);

        const averageComplexity =
          topSymbols.length > 0
            ? Math.round(
                (topSymbols.reduce((acc, s) => acc + (s.cyclomaticComplexity ?? 1), 0) /
                  topSymbols.length) *
                  10,
              ) / 10
            : 0;

        return JSON.stringify(
          {
            limit,
            evaluatedSymbolsCount: topSymbols.length,
            averageTopComplexity: averageComplexity,
            topComplexSymbols: topSymbols.map((s) => ({
              name: s.name,
              kind: s.kind,
              filePath: s.filePath,
              line: s.line,
              complexity: s.cyclomaticComplexity ?? 1,
              riskLevel:
                (s.cyclomaticComplexity ?? 1) > 15
                  ? 'high'
                  : (s.cyclomaticComplexity ?? 1) > 8
                    ? 'medium'
                    : 'low',
              refactorAdvice:
                (s.cyclomaticComplexity ?? 1) > 15
                  ? 'High branching complexity. Consider decomposing into smaller subroutines or extracting strategy handlers.'
                  : (s.cyclomaticComplexity ?? 1) > 8
                    ? 'Moderate branching complexity. Ensure adequate unit test branch coverage.'
                    : 'Low complexity, easy to maintain.',
            })),
          },
          null,
          2,
        );
      }

      case 'atlas_trace_execution_path': {
        const fromNode = String(args.fromNode ?? '').replace(/\\/g, '/');
        const toNode = String(args.toNode ?? '').replace(/\\/g, '/');

        const { db, projectId } = this.openDb();
        const depRepo = new DependencyRepository(db);
        const deps = depRepo.getAll(projectId);

        const graph = new DependencyGraph();
        graph.addEdges(deps);

        const executionPath = graph.findExecutionPath(fromNode, toNode);

        return JSON.stringify(
          {
            found: Boolean(executionPath),
            from: fromNode,
            to: toNode,
            pathLength: executionPath ? executionPath.nodes.length : 0,
            executionPath: executionPath || null,
            message: executionPath
              ? `Found execution path of ${executionPath.steps.length} step(s) with ${Math.round(executionPath.totalConfidence * 100)}% overall confidence.`
              : `No reachable execution path found between "${fromNode}" and "${toNode}".`,
          },
          null,
          2,
        );
      }

      case 'atlas_find_entry_points': {
        const targetNode = String(args.targetNode ?? '').replace(/\\/g, '/');
        const maxDepth = typeof args.maxDepth === 'number' ? args.maxDepth : 10;

        const { db, projectId } = this.openDb();
        const depRepo = new DependencyRepository(db);
        const deps = depRepo.getAll(projectId);

        const graph = new DependencyGraph();
        graph.addEdges(deps);

        const entryPoints = graph.findEntryPoints(targetNode, maxDepth);

        return JSON.stringify(
          {
            targetNode,
            entryPointCount: entryPoints.length,
            entryPoints,
          },
          null,
          2,
        );
      }

      case 'atlas_calculate_change_surface': {
        const rawFiles = Array.isArray(args.filePaths) ? (args.filePaths as string[]) : [];
        const filePaths = rawFiles.map((f) => String(f).replace(/\\/g, '/'));
        const maxDepth = typeof args.maxDepth === 'number' ? args.maxDepth : 5;

        const { db, projectId } = this.openDb();
        const depRepo = new DependencyRepository(db);
        const deps = depRepo.getAll(projectId);

        const graph = new DependencyGraph();
        graph.addEdges(deps);

        const surface = graph.calculateChangeSurface(filePaths, maxDepth);

        return JSON.stringify(surface, null, 2);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  public startStdioServer(): void {
    process.stderr.write('[mcp] Starting CodeAtlas MCP Stdio Server...\n');

    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false,
    });

    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const request = JSON.parse(trimmed) as JsonRpcRequest;
        const response = await this.handleMessage(request);
        if (response) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch {
        const errorResponse: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
          },
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    });

    process.on('SIGINT', () => {
      process.exit(0);
    });
  }
}

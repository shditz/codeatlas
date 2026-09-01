import * as vscode from 'vscode';
import path from 'node:path';
import fs from 'node:fs';
import type { AtlasDatabase } from '@codeatlas-ai/storage';
import { DependencyRepository, FileRepository } from '@codeatlas-ai/storage';
import { DependencyGraph } from '@codeatlas-ai/graph';
import { CycleDetector, ArchitectureAnalyzer } from '@codeatlas-ai/analytics';
import { normalizePath } from '@codeatlas-ai/shared';

export const DIAGNOSTIC_SOURCE = 'CodeAtlas';
export const CODE_CIRCULAR_DEPENDENCY = 'codeatlas:circular-dependency';
export const CODE_ARCHITECTURE_VIOLATION = 'codeatlas:architecture-violation';

export class ArchitectureDiagnosticsProvider implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private disposables: vscode.Disposable[] = [];
  private depRepo: DependencyRepository | null = null;
  private fileRepo: FileRepository | null = null;
  private graph: DependencyGraph | null = null;

  constructor(
    private db: AtlasDatabase | null,
    private workspaceRoot: string,
    private projectId: number = 1,
  ) {
    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection('codeatlas-architecture');
    this.updateRepos();

    this.disposables.push(
      this.diagnosticCollection,
      vscode.workspace.onDidSaveTextDocument(() => this.refreshDiagnostics()),
    );

    this.refreshDiagnostics();
  }

  setDatabase(db: AtlasDatabase | null, projectId: number = 1): void {
    this.db = db;
    this.projectId = projectId;
    this.updateRepos();
    this.refreshDiagnostics();
  }

  private updateRepos(): void {
    if (this.db) {
      this.depRepo = new DependencyRepository(this.db);
      this.fileRepo = new FileRepository(this.db);
      try {
        const deps = this.depRepo.getAll(this.projectId);
        this.graph = new DependencyGraph();
        this.graph.addEdges(deps);
      } catch {
        this.graph = null;
      }
    } else {
      this.depRepo = null;
      this.fileRepo = null;
      this.graph = null;
    }
  }

  public refreshDiagnostics(): void {
    this.diagnosticCollection.clear();

    if (!this.db || !this.workspaceRoot || !this.graph || !this.depRepo) {
      return;
    }

    const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();

    try {
      const cycleDetector = new CycleDetector(this.graph);
      const cycleResult = cycleDetector.detectCycles();

      for (const cycle of cycleResult.cycles) {
        for (let i = 0; i < cycle.length - 1; i++) {
          const source = cycle[i];
          const target = cycle[i + 1];
          if (!source || !target) continue;

          const sourceFullPath = path.join(this.workspaceRoot, source);
          if (!fs.existsSync(sourceFullPath)) continue;

          const range = this.findImportLineRange(sourceFullPath, target);
          const diag = new vscode.Diagnostic(
            range,
            `CodeAtlas Linter Guard: Circular dependency detected [${cycle.join(' ➔ ')}]. This violates clean DAG architecture and can cause runtime initialization bugs.`,
            vscode.DiagnosticSeverity.Warning,
          );
          diag.source = DIAGNOSTIC_SOURCE;
          diag.code = CODE_CIRCULAR_DEPENDENCY;

          const list = diagnosticsByFile.get(sourceFullPath) ?? [];
          list.push(diag);
          diagnosticsByFile.set(sourceFullPath, list);
        }
      }

      const files = this.fileRepo ? this.fileRepo.getAll(this.projectId) : [];
      const archAnalyzer = new ArchitectureAnalyzer({
        graph: this.graph,
        files,
      });
      const archReport = archAnalyzer.analyze();

      for (const violation of archReport.violations) {
        const sourceFullPath = path.join(this.workspaceRoot, violation.sourceFile);
        if (!fs.existsSync(sourceFullPath)) continue;

        const range = this.findImportLineRange(sourceFullPath, violation.targetFile);
        const diag = new vscode.Diagnostic(
          range,
          `CodeAtlas Architecture Guard: ${violation.violationType} (${violation.description}). Remediation: ${violation.remediation}`,
          violation.severity === 'CRITICAL' || violation.severity === 'HIGH'
            ? vscode.DiagnosticSeverity.Error
            : vscode.DiagnosticSeverity.Warning,
        );
        diag.source = DIAGNOSTIC_SOURCE;
        diag.code = CODE_ARCHITECTURE_VIOLATION;

        const list = diagnosticsByFile.get(sourceFullPath) ?? [];
        list.push(diag);
        diagnosticsByFile.set(sourceFullPath, list);
      }
    } catch {
      // Gracefully handle analysis errors
    }

    for (const [filePath, diags] of diagnosticsByFile.entries()) {
      const uri = vscode.Uri.file(filePath);
      this.diagnosticCollection.set(uri, diags);
    }
  }

  private findImportLineRange(filePath: string, targetFile: string): vscode.Range {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const targetBase = path.basename(targetFile, path.extname(targetFile));

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] || '';
        if (
          (line.includes('import ') || line.includes('require(')) &&
          (line.includes(targetBase) || line.includes(targetFile))
        ) {
          return new vscode.Range(i, 0, i, line.length);
        }
      }
    } catch {
      // Fallback
    }

    return new vscode.Range(0, 0, 0, 0);
  }

  public dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

export class ArchitectureCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== DIAGNOSTIC_SOURCE) continue;

      if (diagnostic.code === CODE_CIRCULAR_DEPENDENCY) {
        const fixAction = new vscode.CodeAction(
          '💡 CodeAtlas Auto-Repair: Refactor cycle using Interface or Shared Module',
          vscode.CodeActionKind.QuickFix,
        );
        fixAction.diagnostics = [diagnostic];
        fixAction.isPreferred = true;

        const edit = new vscode.WorkspaceEdit();
        const lineIdx = diagnostic.range.start.line;
        const comment = `// TODO (CodeAtlas): Break circular dependency by moving shared types/interfaces to a shared module\n`;
        edit.insert(document.uri, new vscode.Position(lineIdx, 0), comment);
        fixAction.edit = edit;
        actions.push(fixAction);

        const graphAction = new vscode.CodeAction(
          '🔍 View Circular Dependency in Architecture Graph',
          vscode.CodeActionKind.QuickFix,
        );
        graphAction.diagnostics = [diagnostic];
        const relativePath = normalizePath(
          path.relative(
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            document.uri.fsPath,
          ),
        );
        graphAction.command = {
          command: 'codeatlas.focusInGraph',
          title: 'Focus in Graph',
          arguments: [relativePath],
        };
        actions.push(graphAction);
      } else if (diagnostic.code === CODE_ARCHITECTURE_VIOLATION) {
        const reviewAction = new vscode.CodeAction(
          '🛡️ CodeAtlas Guard: Insert architecture boundary bypass annotation with rationale',
          vscode.CodeActionKind.QuickFix,
        );
        reviewAction.diagnostics = [diagnostic];
        const edit = new vscode.WorkspaceEdit();
        const lineIdx = diagnostic.range.start.line;
        const comment = `// codeatlas-ignore-violation: Reviewed layer boundary rationale\n`;
        edit.insert(document.uri, new vscode.Position(lineIdx, 0), comment);
        reviewAction.edit = edit;
        actions.push(reviewAction);

        const graphAction = new vscode.CodeAction(
          '🔍 Inspect Violation Path in Architecture Graph',
          vscode.CodeActionKind.QuickFix,
        );
        graphAction.diagnostics = [diagnostic];
        const relativePath = normalizePath(
          path.relative(
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            document.uri.fsPath,
          ),
        );
        graphAction.command = {
          command: 'codeatlas.focusInGraph',
          title: 'Focus in Graph',
          arguments: [relativePath],
        };
        actions.push(graphAction);
      }
    }

    return actions;
  }
}

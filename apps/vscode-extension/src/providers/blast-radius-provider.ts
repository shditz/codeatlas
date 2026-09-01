import * as vscode from 'vscode';
import path from 'node:path';
import type { AtlasDatabase } from '@codeatlas-ai/storage';
import { DependencyRepository } from '@codeatlas-ai/storage';
import { DependencyGraph } from '@codeatlas-ai/graph';
import { normalizePath } from '@codeatlas-ai/shared';

export interface BlastRadiusResult {
  filePath: string;
  directDependents: string[];
  transitiveDependents: string[];
  totalAffectedCount: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'leaf';
  pageRank?: number;
}

export class BlastRadiusProvider {
  private statusBarItem: vscode.StatusBarItem;
  private depRepo: DependencyRepository | null = null;
  private graph: DependencyGraph | null = null;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private db: AtlasDatabase | null,
    private workspaceRoot: string,
    private projectId: number = 1,
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 95);
    this.statusBarItem.command = 'codeatlas.showBlastRadiusQuickPick';

    this.updateRepos();

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.updateStatusBar()),
      vscode.workspace.onDidSaveTextDocument(() => this.updateStatusBar()),
    );

    this.updateStatusBar();
  }

  setDatabase(db: AtlasDatabase | null, projectId: number = 1): void {
    this.db = db;
    this.projectId = projectId;
    this.updateRepos();
    this.updateStatusBar();
  }

  private updateRepos(): void {
    if (this.db) {
      this.depRepo = new DependencyRepository(this.db);
      try {
        const deps = this.depRepo.getAll(this.projectId);
        this.graph = new DependencyGraph();
        this.graph.addEdges(deps);
      } catch {
        this.graph = null;
      }
    } else {
      this.depRepo = null;
      this.graph = null;
    }
  }

  public calculateBlastRadius(documentUri: vscode.Uri): BlastRadiusResult | null {
    if (!this.db || !this.workspaceRoot || !this.graph || !this.depRepo) {
      return null;
    }

    const relativePath = normalizePath(path.relative(this.workspaceRoot, documentUri.fsPath));
    if (!relativePath || relativePath.startsWith('..')) {
      return null;
    }

    const directDeps = this.depRepo.getDependents(this.projectId, relativePath);
    const directDependents = directDeps.map((d) => d.source);

    const allTransitiveSet = this.graph.getDependents(relativePath, 3);
    const transitiveOnly = Array.from(allTransitiveSet).filter(
      (p) => !directDependents.includes(p) && p !== relativePath,
    );

    const totalAffectedCount = directDependents.length + transitiveOnly.length;

    let riskLevel: BlastRadiusResult['riskLevel'] = 'leaf';
    if (totalAffectedCount >= 10) riskLevel = 'critical';
    else if (totalAffectedCount >= 5) riskLevel = 'high';
    else if (totalAffectedCount >= 2) riskLevel = 'medium';
    else if (totalAffectedCount >= 1) riskLevel = 'low';

    const pageRank = this.graph.getPageRank(relativePath);

    return {
      filePath: relativePath,
      directDependents,
      transitiveDependents: transitiveOnly,
      totalAffectedCount,
      riskLevel,
      pageRank: pageRank !== undefined ? Number(pageRank.toFixed(3)) : undefined,
    };
  }

  public updateStatusBar(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.db || !this.workspaceRoot) {
      this.statusBarItem.hide();
      return;
    }

    const blast = this.calculateBlastRadius(editor.document.uri);
    if (!blast) {
      this.statusBarItem.text = `$(map) CodeAtlas`;
      this.statusBarItem.tooltip = 'CodeAtlas: Active repository map';
      this.statusBarItem.show();
      return;
    }

    const riskIcon =
      blast.riskLevel === 'critical'
        ? '$(flame)'
        : blast.riskLevel === 'high'
          ? '$(warning)'
          : blast.riskLevel === 'medium'
            ? '$(zap)'
            : blast.riskLevel === 'low'
              ? '$(info)'
              : '$(shield-check)';

    const countText =
      blast.totalAffectedCount === 0
        ? 'Leaf Node'
        : `${blast.totalAffectedCount} file${blast.totalAffectedCount > 1 ? 's' : ''}`;

    this.statusBarItem.text = `${riskIcon} Blast: ${countText} (${blast.riskLevel.toUpperCase()})`;
    this.statusBarItem.tooltip = new vscode.MarkdownString(
      `### 💥 Live Blast Radius Analysis\n\n` +
        `**File**: \`${blast.filePath}\`\n\n` +
        `- **Direct Inbound Callers**: ${blast.directDependents.length}\n` +
        `- **Transitive Cascades**: ${blast.transitiveDependents.length}\n` +
        `- **Risk Impact**: **${blast.riskLevel.toUpperCase()}**\n` +
        (blast.pageRank ? `- **PageRank Centrality**: \`${blast.pageRank}\`\n\n` : '\n') +
        `*Click to view full impact breakdown & copy prompt for AI.*`,
    );

    this.statusBarItem.show();
  }

  public async showQuickPick(targetUri?: vscode.Uri): Promise<void> {
    const uri = targetUri || vscode.window.activeTextEditor?.document.uri;
    if (!uri) {
      vscode.window.showInformationMessage('CodeAtlas: Open a file to analyze its blast radius.');
      return;
    }

    const blast = this.calculateBlastRadius(uri);
    if (!blast) {
      vscode.window.showWarningMessage('CodeAtlas: File is not yet indexed in graph.');
      return;
    }

    const items: vscode.QuickPickItem[] = [];

    items.push({
      label: `💥 Blast Radius: ${blast.totalAffectedCount} Total Affected Files (${blast.riskLevel.toUpperCase()})`,
      description: `File: ${blast.filePath}`,
      kind: vscode.QuickPickItemKind.Separator,
    });

    items.push({
      label: `$(type-hierarchy) Focus in Architecture Graph`,
      description: `Open 2D/3D map spotlighting all ${blast.totalAffectedCount} dependent nodes`,
      detail: 'action:focusGraph',
    });

    items.push({
      label: `$(clippy) Copy AI Prompt Context for Blast Radius`,
      description: `Copy structured impact analysis to clipboard for Claude, Cursor, or ChatGPT`,
      detail: 'action:copyPrompt',
    });

    if (blast.directDependents.length > 0) {
      items.push({
        label: `Direct Inbound Callers (${blast.directDependents.length})`,
        kind: vscode.QuickPickItemKind.Separator,
      });

      for (const dep of blast.directDependents) {
        items.push({
          label: `$(file) ${dep}`,
          description: 'Direct Dependent (imports this module)',
          detail: `file:${dep}`,
        });
      }
    }

    if (blast.transitiveDependents.length > 0) {
      items.push({
        label: `Transitive Cascade Dependents (${blast.transitiveDependents.length})`,
        kind: vscode.QuickPickItemKind.Separator,
      });

      for (const dep of blast.transitiveDependents) {
        items.push({
          label: `$(references) ${dep}`,
          description: 'Transitive Dependent (2+ hops away)',
          detail: `file:${dep}`,
        });
      }
    }

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Blast Radius for ${blast.filePath} (${blast.totalAffectedCount} files impacted)`,
    });

    if (!selected || !selected.detail) return;

    if (selected.detail === 'action:focusGraph') {
      vscode.commands.executeCommand('codeatlas.focusInGraph', blast.filePath);
    } else if (selected.detail === 'action:copyPrompt') {
      const prompt = `### 💥 CodeAtlas Blast Radius Impact Analysis
- **Target File**: \`${blast.filePath}\`
- **Risk Level**: **${blast.riskLevel.toUpperCase()}**
- **Direct Dependents (${blast.directDependents.length})**:
${blast.directDependents.map((d) => `  - \`${d}\``).join('\n') || '  - None (Leaf file)'}
- **Transitive Dependents (${blast.transitiveDependents.length})**:
${blast.transitiveDependents.map((d) => `  - \`${d}\``).join('\n') || '  - None'}

**AI Directive**: When editing \`${blast.filePath}\`, verify you do not break exported interfaces or assumptions relied upon by the above dependent modules.`;

      await vscode.env.clipboard.writeText(prompt);
      vscode.window.showInformationMessage(
        'CodeAtlas: Blast radius AI prompt copied to clipboard!',
      );
    } else if (selected.detail.startsWith('file:')) {
      const filePath = selected.detail.replace('file:', '');
      const fullPath = vscode.Uri.joinPath(vscode.Uri.file(this.workspaceRoot), filePath);
      const doc = await vscode.workspace.openTextDocument(fullPath);
      await vscode.window.showTextDocument(doc);
    }
  }

  public dispose(): void {
    this.statusBarItem.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

import * as vscode from 'vscode';
import path from 'node:path';
import fs from 'node:fs';
import {
  FileRepository,
  DependencyRepository,
  AtlasDatabase,
  runMigrations,
} from '@codeatlas-ai/storage';
import { DependencyGraph } from '@codeatlas-ai/graph';

export class GraphViewProvider {
  public static currentPanel: GraphViewProvider | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private _db: AtlasDatabase | null = null;
  private _projectId: number = 1;

  public static createOrShow(
    extensionUri: vscode.Uri,
    db: AtlasDatabase | null,
    projectId: number,
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (GraphViewProvider.currentPanel) {
      GraphViewProvider.currentPanel.setDatabase(db, projectId);
      GraphViewProvider.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'codeatlasGraph',
      'CodeAtlas: Architecture Graph',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          extensionUri,
          vscode.Uri.joinPath(extensionUri, 'webview', 'dist'),
          vscode.Uri.joinPath(extensionUri, '..', 'webview', 'dist'),
          vscode.Uri.joinPath(extensionUri, 'dist'),
        ],
      },
    );

    GraphViewProvider.currentPanel = new GraphViewProvider(panel, extensionUri, db, projectId);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    db: AtlasDatabase | null,
    projectId: number,
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._db = db;
    this._projectId = projectId;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'ready':
            this._sendGraphData();
            return;
          case 'openFile':
            if (message.path) {
              const wsFolders = vscode.workspace.workspaceFolders;
              if (wsFolders && wsFolders.length > 0 && wsFolders[0]) {
                const fileUri = vscode.Uri.joinPath(wsFolders[0].uri, message.path);
                vscode.workspace.openTextDocument(fileUri).then(
                  (doc) => {
                    vscode.window.showTextDocument(doc, { preview: true });
                  },
                  (err) => {
                    vscode.window.showErrorMessage(
                      `Could not open ${message.path}: ${err.message}`,
                    );
                  },
                );
              }
            }
            return;
        }
      },
      null,
      this._disposables,
    );
  }

  public setDatabase(db: AtlasDatabase | null, projectId: number) {
    this._db = db;
    this._projectId = projectId;
    this._sendGraphData();
  }

  private _sendGraphData() {
    if (!this._db) {
      const wsFolders = vscode.workspace.workspaceFolders;
      if (wsFolders && wsFolders.length > 0 && wsFolders[0]) {
        const dbPath = path.join(wsFolders[0].uri.fsPath, '.atlas', 'atlas.db');
        if (fs.existsSync(dbPath)) {
          try {
            this._db = new AtlasDatabase(dbPath);
            runMigrations(this._db);
          } catch (e) {
            console.error('Failed to init DB for graph view:', e);
          }
        }
      }
    }

    if (!this._db) {
      this._panel.webview.postMessage({
        command: 'error',
        text: 'Database not initialized. Please index the codebase first.',
      });
      return;
    }

    try {
      const fileRepo = new FileRepository(this._db);
      const depRepo = new DependencyRepository(this._db);

      const files = fileRepo.getAll(this._projectId);
      const deps = depRepo.getAll(this._projectId);

      interface GraphNodeData {
        id: string;
        name: string;
        path: string;
        type: string;
        ext?: string;
        color?: string;
        [key: string]: unknown;
      }

      const nodeMap = new Map<string, GraphNodeData>();
      const links: Record<string, unknown>[] = [];

      for (const f of files) {
        const parts = f.relativePath.split('/');
        const name = parts[parts.length - 1] || f.relativePath;
        const dir = parts.slice(0, -1).join('/');
        const ext = name.split('.').pop()?.toLowerCase() || '';

        let color = '#94a3b8';
        if (f.language === 'typescript' || ext === 'ts' || ext === 'tsx') color = '#38bdf8';
        else if (f.language === 'javascript' || ext === 'js' || ext === 'jsx') color = '#facc15';
        else if (f.language === 'php' || ext === 'php') color = '#a78bfa';
        else if (f.language === 'python' || ext === 'py') color = '#34d399';
        else if (ext === 'css' || ext === 'scss' || ext === 'less') color = '#f43f5e';
        else if (ext === 'html' || ext === 'htm') color = '#fb923c';
        else if (ext === 'md' || ext === 'json' || ext === 'yaml' || ext === 'yml')
          color = '#e2e8f0';

        nodeMap.set(f.relativePath, {
          id: f.relativePath,
          name: name,
          path: f.relativePath,
          type: 'file',
          language: f.language || ext || 'text',
          size: f.size || 0,
          val: Math.max(2, Math.min(8, Math.sqrt(f.size || 100) * 0.3)),
          color,
        });

        if (dir) {
          let currentPath = '';
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i] || '';
            const parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            if (!nodeMap.has(currentPath)) {
              nodeMap.set(currentPath, {
                id: currentPath,
                name: part,
                path: currentPath,
                type: 'dir',
                language: 'directory',
                size: 0,
                val: 5,
                color: '#c084fc',
              });
            }
            if (
              parentPath &&
              !links.some((l) => l.source === parentPath && l.target === currentPath)
            ) {
              links.push({
                source: parentPath,
                target: currentPath,
                type: 'contains',
              });
            }
          }
          if (!links.some((l) => l.source === dir && l.target === f.relativePath)) {
            links.push({
              source: dir,
              target: f.relativePath,
              type: 'contains',
            });
          }
        }
      }

      const graph = new DependencyGraph();
      for (const d of deps) {
        graph.addEdge({
          source: d.source,
          target: d.target,
          kind: d.kind || 'import',
          symbols: d.symbols || [],
          weight: d.weight || 1,
        });
      }
      const communities = graph.detectCommunities(6);

      for (const d of deps) {
        if (nodeMap.has(d.source) && nodeMap.has(d.target)) {
          links.push({
            source: d.source,
            target: d.target,
            type: d.kind || 'import',
          });
        }
      }

      const nodes = Array.from(nodeMap.values()).map((node) => ({
        ...node,
        communityId: communities.get(node.id) ?? 0,
      }));

      this._panel.webview.postMessage({
        command: 'setGraphData',
        data: { nodes, links },
      });
    } catch (err) {
      console.error('Failed to get graph data:', err);
    }
  }

  public dispose() {
    GraphViewProvider.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;

    let webviewDistPath = vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist');
    if (!fs.existsSync(path.join(webviewDistPath.fsPath, 'index.html'))) {
      webviewDistPath = vscode.Uri.joinPath(this._extensionUri, '..', 'webview', 'dist');
    }
    const indexHtmlPath = path.join(webviewDistPath.fsPath, 'index.html');

    let html = '';
    if (fs.existsSync(indexHtmlPath)) {
      html = fs.readFileSync(indexHtmlPath, 'utf8');

      const assetUri = webview.asWebviewUri(webviewDistPath).toString();

      html = html.replace(/(src|href)="\/assets\//g, `$1="${assetUri}/assets/`);
      html = html.replace(/(src|href)="\/favicon\.svg"/g, `$1="${assetUri}/favicon.svg"`);
      html = html.replace(/(src|href)="\/icons\.svg"/g, `$1="${assetUri}/icons.svg"`);

      const cspSource = webview.cspSource;
      const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data: blob:; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline' 'unsafe-eval'; connect-src ${cspSource} https: data: blob:; font-src ${cspSource} data:;">`;
      html = html.replace('<head>', `<head>\n    ${csp}`);
    } else {
      html = `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>CodeAtlas Graph</title>
          <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #0f172a; color: white; }
          </style>
      </head>
      <body>
          <h2>Please build the webview app first.</h2>
          <p>Run: <code>cd apps/webview && pnpm build</code></p>
      </body>
      </html>`;
    }

    this._panel.webview.html = html;
  }
}

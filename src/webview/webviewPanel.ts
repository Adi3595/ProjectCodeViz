import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GraphData } from '../models';

export class WebviewPanel {
  public static currentPanel: WebviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(context: vscode.ExtensionContext, graphData: GraphData, rootPath: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (WebviewPanel.currentPanel) {
      WebviewPanel.currentPanel._panel.reveal(column);
      WebviewPanel.currentPanel.update(graphData);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'projectCodeWiz',
      'ProjectCodeWiz — Code Visualization',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
          vscode.Uri.joinPath(context.extensionUri, 'out'),
        ],
      }
    );

    graphData.meta.rootPath = rootPath;
    WebviewPanel.currentPanel = new WebviewPanel(panel, context.extensionUri, graphData);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    graphData: GraphData
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      null,
      this._disposables
    );

    this._panel.webview.html = this.getHtml(graphData);
  }

  private async handleMessage(message: any) {
    switch (message.command) {
      case 'openFile':
        if (message.file && message.file !== 'external') {
          const uri = vscode.Uri.file(message.file);
          vscode.window.showTextDocument(uri, {
            preview: true,
            selection: message.line
              ? new vscode.Range(message.line - 1, 0, message.line - 1, 0)
              : undefined,
          });
        }
        break;
      case 'info':
        vscode.window.showInformationMessage(message.text);
        break;
      case 'aiAnalyze':
        await this.handleAIAnalyze(message);
        break;
    }
  }

  private async handleAIAnalyze(message: any) {
    const { file, line, label, type } = message;

    // Open the file first so AI commands can access it
    if (file && file !== 'external') {
      try {
        const uri = vscode.Uri.file(file);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, {
          preview: true,
          preserveFocus: false,
          selection: line ? new vscode.Range(line - 1, 0, line - 1, 0) : undefined,
        });

        // Small delay to ensure the editor is active
        await new Promise(resolve => setTimeout(resolve, 200));

        // Trigger the appropriate AI command
        switch (type) {
          case 'errors':
            await vscode.commands.executeCommand('projectcodewiz.analyzeErrors');
            break;
          case 'explain':
            await vscode.commands.executeCommand('projectcodewiz.explainCode');
            break;
          case 'insights':
            await vscode.commands.executeCommand('projectcodewiz.codeInsights');
            break;
          default:
            await vscode.commands.executeCommand('projectcodewiz.explainCode');
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`ProjectCodeWiz AI: Could not analyze "${label}" — ${err.message}`);
      }
    } else {
      vscode.window.showWarningMessage(`ProjectCodeWiz AI: Cannot analyze external node "${label}".`);
    }
  }

  public update(graphData: GraphData) {
    this._panel.webview.html = this.getHtml(graphData);
  }

  private getHtml(graphData: GraphData): string {
    const htmlPath = path.join(
      this._extensionUri.fsPath,
      'media',
      'webview.html'
    );

    let html: string;
    try {
      html = fs.readFileSync(htmlPath, 'utf8');
    } catch {
      // Fallback: embed inline if file not found
      html = this.getFallbackHtml();
    }

    const graphJson = JSON.stringify(graphData)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');

    html = html.replace('__GRAPH_DATA__', graphJson);
    return html;
  }

  private getFallbackHtml(): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>ProjectCodeWiz</title></head>
<body>
<h1>ProjectCodeWiz</h1>
<p>Error: Could not load webview.html from media folder.</p>
<script>
const graphData = __GRAPH_DATA__;
console.log('Graph data:', graphData);
</script>
</body>
</html>`;
  }

  public dispose() {
    WebviewPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) { x.dispose(); }
    }
  }
}

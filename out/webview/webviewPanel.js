"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebviewPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class WebviewPanel {
    static createOrShow(context, graphData, rootPath) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (WebviewPanel.currentPanel) {
            WebviewPanel.currentPanel._panel.reveal(column);
            WebviewPanel.currentPanel.update(graphData);
            return;
        }
        const panel = vscode.window.createWebviewPanel('projectCodeWiz', 'ProjectCodeWiz — Code Visualization', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, 'media'),
                vscode.Uri.joinPath(context.extensionUri, 'out'),
            ],
        });
        graphData.meta.rootPath = rootPath;
        WebviewPanel.currentPanel = new WebviewPanel(panel, context.extensionUri, graphData);
    }
    constructor(panel, extensionUri, graphData) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(message => this.handleMessage(message), null, this._disposables);
        this._panel.webview.html = this.getHtml(graphData);
    }
    async handleMessage(message) {
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
    async handleAIAnalyze(message) {
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
            }
            catch (err) {
                vscode.window.showErrorMessage(`ProjectCodeWiz AI: Could not analyze "${label}" — ${err.message}`);
            }
        }
        else {
            vscode.window.showWarningMessage(`ProjectCodeWiz AI: Cannot analyze external node "${label}".`);
        }
    }
    update(graphData) {
        this._panel.webview.html = this.getHtml(graphData);
    }
    getHtml(graphData) {
        const htmlPath = path.join(this._extensionUri.fsPath, 'media', 'webview.html');
        let html;
        try {
            html = fs.readFileSync(htmlPath, 'utf8');
        }
        catch {
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
    getFallbackHtml() {
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
    dispose() {
        WebviewPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
exports.WebviewPanel = WebviewPanel;

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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const workspaceScanner_1 = require("./parser/workspaceScanner");
const multiLanguageParser_1 = require("./parser/multiLanguageParser");
const relationshipAnalyzer_1 = require("./analyzer/relationshipAnalyzer");
const errorDetector_1 = require("./analyzer/errorDetector");
const graphBuilder_1 = require("./graph/graphBuilder");
const webviewPanel_1 = require("./webview/webviewPanel");
const aiService_1 = require("./ai/aiService");
const aiHoverProvider_1 = require("./ai/aiHoverProvider");
const aiResultPanel_1 = require("./ai/aiResultPanel");
function activate(context) {
    console.log('ProjectCodeWiz v1.8.5 is now active!');
    // ── AI Service ──────────────────────────────────────────────
    const aiService = new aiService_1.AIService();
    const aiHoverProvider = new aiHoverProvider_1.AIHoverProvider(aiService);
    // ── Status Bar ──────────────────────────────────────────────
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = '$(graph) Visualize';
    statusBar.tooltip = 'ProjectCodeWiz: Visualize Code Structure (C++, Python, Java, JS/TS)';
    statusBar.command = 'projectcodewiz.visualize';
    statusBar.show();
    context.subscriptions.push(statusBar);
    // AI Status Bar
    const aiStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    updateAIStatusBar(aiStatusBar, aiService);
    aiStatusBar.command = 'projectcodewiz.configureAI';
    aiStatusBar.show();
    context.subscriptions.push(aiStatusBar);
    // ── Register Hover Provider ─────────────────────────────────
    const supportedLanguages = [
        'cpp', 'c', 'python', 'java', 'javascript', 'javascriptreact',
        'typescript', 'typescriptreact',
    ];
    for (const lang of supportedLanguages) {
        context.subscriptions.push(vscode.languages.registerHoverProvider({ language: lang, scheme: 'file' }, aiHoverProvider));
    }
    // ── Command: Visualize ──────────────────────────────────────
    const visualizeCmd = vscode.commands.registerCommand('projectcodewiz.visualize', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('ProjectCodeWiz: No workspace folder is open.');
            return;
        }
        const rootPath = workspaceFolders[0].uri.fsPath;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'ProjectCodeWiz',
            cancellable: true,
        }, async (progress, token) => {
            try {
                // Step 1: Scan workspace
                progress.report({ increment: 5, message: 'Scanning workspace...' });
                const config = vscode.workspace.getConfiguration('projectcodewiz');
                const ignorePaths = config.get('ignorePaths') || [];
                const maxFileSizeKB = config.get('maxFileSizeKB') || 500;
                const scanner = new workspaceScanner_1.WorkspaceScanner(rootPath, ignorePaths, maxFileSizeKB);
                const files = await scanner.scan();
                if (token.isCancellationRequested) {
                    return;
                }
                if (files.length === 0) {
                    vscode.window.showWarningMessage('ProjectCodeWiz: No supported files found in workspace. (C++, Python, Java, JS/TS)');
                    return;
                }
                // Detect languages
                const langCounts = multiLanguageParser_1.MultiLanguageParser.detectLanguages(files);
                const langSummary = Array.from(langCounts.entries())
                    .map(([lang, count]) => `${lang}: ${count}`)
                    .join(', ');
                console.log(`ProjectCodeWiz: Found files — ${langSummary}`);
                // Step 2: Parse files (multi-language)
                progress.report({ increment: 15, message: `Parsing ${files.length} file(s)...` });
                const parser = new multiLanguageParser_1.MultiLanguageParser();
                const parseResults = await parser.parseFiles(files, (i, total, file) => {
                    progress.report({ message: `Parsing (${i}/${total}): ${path.basename(file)}` });
                });
                if (token.isCancellationRequested) {
                    return;
                }
                // Step 3: Run error detection (multi-language)
                progress.report({ increment: 20, message: 'Detecting errors...' });
                const clangPath = config.get('clangPath') || 'clang';
                const errorDetector = new errorDetector_1.ErrorDetector(clangPath);
                const errorMap = await errorDetector.analyzeFiles(files);
                if (token.isCancellationRequested) {
                    return;
                }
                // Step 4: Analyze relationships
                progress.report({ increment: 25, message: 'Analyzing relationships...' });
                const analyzer = new relationshipAnalyzer_1.RelationshipAnalyzer();
                const analysisResult = analyzer.analyze(parseResults, errorMap);
                if (token.isCancellationRequested) {
                    return;
                }
                // Step 5: Build graph model
                progress.report({ increment: 20, message: 'Building graph model...' });
                const graphBuilder = new graphBuilder_1.GraphBuilder();
                const graphData = graphBuilder.build(analysisResult);
                if (token.isCancellationRequested) {
                    return;
                }
                // Step 6: Open Webview
                progress.report({ increment: 15, message: 'Rendering visualization...' });
                webviewPanel_1.WebviewPanel.createOrShow(context, graphData, rootPath);
                const errorCount = Array.from(errorMap.values()).reduce((sum, errs) => sum + errs.length, 0);
                let resultMessage = `ProjectCodeWiz: Visualized ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`;
                if (langCounts.size > 0) {
                    resultMessage += ` (${Array.from(langCounts.keys()).join(', ')})`;
                }
                if (errorCount > 0) {
                    resultMessage += ` — ${errorCount} error(s)/warning(s) detected`;
                }
                resultMessage += '.';
                vscode.window.showInformationMessage(resultMessage);
            }
            catch (err) {
                vscode.window.showErrorMessage(`ProjectCodeWiz Error: ${err.message}`);
                console.error('ProjectCodeWiz error:', err);
            }
        });
    });
    // ── Command: Configure AI ───────────────────────────────────
    const configureAICmd = vscode.commands.registerCommand('projectcodewiz.configureAI', async () => {
        const configured = await aiService.configureApiKey();
        if (configured) {
            updateAIStatusBar(aiStatusBar, aiService);
        }
    });
    // ── Command: Explain Code (AI) ─────────────────────────────
    const explainCodeCmd = vscode.commands.registerCommand('projectcodewiz.explainCode', async () => {
        if (!ensureAIConfigured(aiService)) {
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('ProjectCodeWiz AI: No active editor.');
            return;
        }
        const selection = editor.selection;
        const code = selection.isEmpty
            ? editor.document.getText()
            : editor.document.getText(selection);
        if (!code.trim()) {
            vscode.window.showWarningMessage('ProjectCodeWiz AI: No code selected or file is empty.');
            return;
        }
        const language = mapLanguageId(editor.document.languageId);
        const fileName = path.basename(editor.document.fileName);
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'ProjectCodeWiz AI: Explaining code...', cancellable: false }, async () => {
            try {
                const result = await aiService.explainCode(code, language, fileName);
                aiResultPanel_1.AIResultPanel.show(context, `Code Explanation — ${fileName}`, result, aiService.getProviderLabel(), '📖');
            }
            catch (err) {
                vscode.window.showErrorMessage(`ProjectCodeWiz AI Error: ${err.message}`);
            }
        });
    });
    // ── Command: Analyze Errors (AI) ───────────────────────────
    const analyzeErrorsCmd = vscode.commands.registerCommand('projectcodewiz.analyzeErrors', async () => {
        if (!ensureAIConfigured(aiService)) {
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('ProjectCodeWiz AI: No active editor.');
            return;
        }
        const code = editor.document.getText();
        const language = mapLanguageId(editor.document.languageId);
        const fileName = path.basename(editor.document.fileName);
        // Gather VS Code diagnostics for this file
        const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
        const errorMessages = diagnostics.map(d => `Line ${d.range.start.line + 1}: [${vscode.DiagnosticSeverity[d.severity]}] ${d.message}`);
        // Also run our own error detection
        const config = vscode.workspace.getConfiguration('projectcodewiz');
        const clangPath = config.get('clangPath') || 'clang';
        const errorDetector = new errorDetector_1.ErrorDetector(clangPath);
        try {
            const detectedErrors = await errorDetector.analyzeFiles([editor.document.fileName]);
            const ownErrors = detectedErrors.get(editor.document.fileName) || [];
            ownErrors.forEach(e => {
                const msg = `Line ${e.line}:${e.column}: [${e.severity}] ${e.message}`;
                if (!errorMessages.includes(msg)) {
                    errorMessages.push(msg);
                }
            });
        }
        catch { /* ignore detection errors */ }
        if (errorMessages.length === 0) {
            // Still let AI analyze even with no detected errors — it may find issues
            errorMessages.push('No errors detected by static analysis, but please review for potential issues.');
        }
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'ProjectCodeWiz AI: Analyzing errors...', cancellable: false }, async () => {
            try {
                const result = await aiService.analyzeErrors(code, language, errorMessages, fileName);
                aiResultPanel_1.AIResultPanel.show(context, `Error Analysis — ${fileName}`, result, aiService.getProviderLabel(), '🔍');
            }
            catch (err) {
                vscode.window.showErrorMessage(`ProjectCodeWiz AI Error: ${err.message}`);
            }
        });
    });
    // ── Command: Suggest Improvements (AI) ─────────────────────
    const suggestImprovementsCmd = vscode.commands.registerCommand('projectcodewiz.suggestImprovements', async () => {
        if (!ensureAIConfigured(aiService)) {
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('ProjectCodeWiz AI: No active editor.');
            return;
        }
        const selection = editor.selection;
        const code = selection.isEmpty
            ? editor.document.getText()
            : editor.document.getText(selection);
        if (!code.trim()) {
            vscode.window.showWarningMessage('ProjectCodeWiz AI: No code selected or file is empty.');
            return;
        }
        const language = mapLanguageId(editor.document.languageId);
        const fileName = path.basename(editor.document.fileName);
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'ProjectCodeWiz AI: Suggesting improvements...', cancellable: false }, async () => {
            try {
                const result = await aiService.suggestImprovements(code, language, fileName);
                aiResultPanel_1.AIResultPanel.show(context, `Improvement Suggestions — ${fileName}`, result, aiService.getProviderLabel(), '🚀');
            }
            catch (err) {
                vscode.window.showErrorMessage(`ProjectCodeWiz AI Error: ${err.message}`);
            }
        });
    });
    // ── Command: Code Insights (AI) ────────────────────────────
    const codeInsightsCmd = vscode.commands.registerCommand('projectcodewiz.codeInsights', async () => {
        if (!ensureAIConfigured(aiService)) {
            return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('ProjectCodeWiz AI: No active editor.');
            return;
        }
        const code = editor.document.getText();
        const language = mapLanguageId(editor.document.languageId);
        const fileName = path.basename(editor.document.fileName);
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'ProjectCodeWiz AI: Generating insights...', cancellable: false }, async () => {
            try {
                const result = await aiService.getCodeInsights(code, language, fileName);
                aiResultPanel_1.AIResultPanel.show(context, `Code Insights — ${fileName}`, result, aiService.getProviderLabel(), '📊');
            }
            catch (err) {
                vscode.window.showErrorMessage(`ProjectCodeWiz AI Error: ${err.message}`);
            }
        });
    });
    // ── Watch for config changes ────────────────────────────────
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('projectcodewiz.aiProvider') ||
            e.affectsConfiguration('projectcodewiz.aiApiKey') ||
            e.affectsConfiguration('projectcodewiz.aiModel')) {
            aiService.loadConfig();
            updateAIStatusBar(aiStatusBar, aiService);
        }
    }));
    // ── Register all commands ───────────────────────────────────
    context.subscriptions.push(visualizeCmd, configureAICmd, explainCodeCmd, analyzeErrorsCmd, suggestImprovementsCmd, codeInsightsCmd);
}
// ── Helpers ─────────────────────────────────────────────────
function updateAIStatusBar(statusBar, aiService) {
    if (aiService.isConfigured()) {
        statusBar.text = `$(hubot) AI: ${aiService.getProviderLabel()}`;
        statusBar.tooltip = 'ProjectCodeWiz AI: Click to reconfigure';
        statusBar.backgroundColor = undefined;
    }
    else {
        statusBar.text = '$(hubot) AI: Not Configured';
        statusBar.tooltip = 'ProjectCodeWiz AI: Click to set up your API key';
        statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}
function ensureAIConfigured(aiService) {
    if (!aiService.isConfigured()) {
        vscode.window.showWarningMessage('ProjectCodeWiz AI is not configured. Set up your API key first.', 'Configure Now').then(choice => {
            if (choice === 'Configure Now') {
                vscode.commands.executeCommand('projectcodewiz.configureAI');
            }
        });
        return false;
    }
    return true;
}
function mapLanguageId(vscodeLangId) {
    const map = {
        'cpp': 'C++',
        'c': 'C',
        'python': 'Python',
        'java': 'Java',
        'javascript': 'JavaScript',
        'javascriptreact': 'JavaScript (JSX)',
        'typescript': 'TypeScript',
        'typescriptreact': 'TypeScript (TSX)',
    };
    return map[vscodeLangId] || vscodeLangId;
}
function deactivate() { }

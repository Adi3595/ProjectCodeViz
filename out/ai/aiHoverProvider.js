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
exports.AIHoverProvider = void 0;
const vscode = __importStar(require("vscode"));
// ============================================================
// AI-Powered Hover Provider
// Provides intelligent code descriptions on hover
// ============================================================
class AIHoverProvider {
    constructor(aiService) {
        this.cache = new Map();
        this.pendingRequests = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        this.enabled = true;
        this.aiService = aiService;
        // Watch for config changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('projectcodewiz.aiHoverEnabled')) {
                this.enabled = vscode.workspace.getConfiguration('projectcodewiz').get('aiHoverEnabled', true);
            }
        });
        this.enabled = vscode.workspace.getConfiguration('projectcodewiz').get('aiHoverEnabled', true);
    }
    async provideHover(document, position, _token) {
        if (!this.enabled || !this.aiService.isConfigured()) {
            return undefined;
        }
        // Get the word range at cursor position
        const wordRange = document.getWordRangeAtPosition(position, /[\w.]+/);
        if (!wordRange) {
            return undefined;
        }
        const word = document.getText(wordRange);
        if (word.length < 2) {
            return undefined;
        }
        // Get surrounding context (the block of code around the hover position)
        const contextRange = this.getContextRange(document, position);
        const contextCode = document.getText(contextRange);
        const language = this.mapLanguageId(document.languageId);
        const cacheKey = `${document.uri.fsPath}:${word}:${contextCode.length}`;
        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return this.buildHover(word, cached.text, language);
        }
        // Debounce: if there's already a pending request for this exact position, wait for it
        if (this.pendingRequests.has(cacheKey)) {
            try {
                const text = await this.pendingRequests.get(cacheKey);
                return this.buildHover(word, text, language);
            }
            catch {
                return undefined;
            }
        }
        // Make AI request
        const requestPromise = this.aiService.getHoverDescription(contextCode, language, word);
        this.pendingRequests.set(cacheKey, requestPromise);
        try {
            const description = await requestPromise;
            this.cache.set(cacheKey, { text: description, timestamp: Date.now() });
            return this.buildHover(word, description, language);
        }
        catch (err) {
            // Silently fail for hover — don't interrupt user workflow
            return undefined;
        }
        finally {
            this.pendingRequests.delete(cacheKey);
        }
    }
    buildHover(word, description, language) {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;
        md.appendMarkdown(`**🧠 ProjectCodeWiz AI** — \`${word}\`\n\n`);
        md.appendMarkdown(`---\n\n`);
        md.appendMarkdown(description);
        md.appendMarkdown(`\n\n---\n`);
        md.appendMarkdown(`*${this.aiService.getProviderLabel()}*`);
        return new vscode.Hover(md);
    }
    getContextRange(document, position) {
        // Get surrounding block of code (up to 30 lines around the cursor)
        const startLine = Math.max(0, position.line - 15);
        const endLine = Math.min(document.lineCount - 1, position.line + 15);
        return new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
    }
    mapLanguageId(vscodeLangId) {
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
    clearCache() {
        this.cache.clear();
    }
}
exports.AIHoverProvider = AIHoverProvider;

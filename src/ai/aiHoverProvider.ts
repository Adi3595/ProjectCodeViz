import * as vscode from 'vscode';
import * as path from 'path';
import { AIService } from './aiService';

// ============================================================
// AI-Powered Hover Provider
// Provides intelligent code descriptions on hover
// ============================================================

export class AIHoverProvider implements vscode.HoverProvider {
  private aiService: AIService;
  private cache = new Map<string, { text: string; timestamp: number }>();
  private pendingRequests = new Map<string, Promise<string>>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private enabled = true;

  constructor(aiService: AIService) {
    this.aiService = aiService;

    // Watch for config changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('projectcodewiz.aiHoverEnabled')) {
        this.enabled = vscode.workspace.getConfiguration('projectcodewiz').get('aiHoverEnabled', true);
      }
    });
    this.enabled = vscode.workspace.getConfiguration('projectcodewiz').get('aiHoverEnabled', true);
  }

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    if (!this.enabled || !this.aiService.isConfigured()) {
      return undefined;
    }

    // Get the word range at cursor position
    const wordRange = document.getWordRangeAtPosition(position, /[\w.]+/);
    if (!wordRange) { return undefined; }

    const word = document.getText(wordRange);
    if (word.length < 2) { return undefined; }

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
        const text = await this.pendingRequests.get(cacheKey)!;
        return this.buildHover(word, text, language);
      } catch {
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
    } catch (err: any) {
      // Silently fail for hover — don't interrupt user workflow
      return undefined;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  private buildHover(word: string, description: string, language: string): vscode.Hover {
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

  private getContextRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range {
    // Get surrounding block of code (up to 30 lines around the cursor)
    const startLine = Math.max(0, position.line - 15);
    const endLine = Math.min(document.lineCount - 1, position.line + 15);
    return new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
  }

  private mapLanguageId(vscodeLangId: string): string {
    const map: Record<string, string> = {
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

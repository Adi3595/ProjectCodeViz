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
exports.AIService = void 0;
const vscode = __importStar(require("vscode"));
const aiProviders_1 = require("./aiProviders");
// ============================================================
// AI Service — Orchestrates all AI features for ProjectCodeWiz
// ============================================================
const SYSTEM_PROMPT = `You are ProjectCodeWiz AI, an expert code analysis assistant embedded in a VS Code extension. 
You analyze code structure, detect errors, suggest improvements, and explain code clearly.
Always be concise but thorough. Use markdown formatting in your responses.
When suggesting improvements, explain WHY each change is beneficial.
When explaining errors, provide the fix inline with the explanation.
Respond in a developer-friendly tone.`;
class AIService {
    constructor() {
        this.config = null;
        this.outputChannel = vscode.window.createOutputChannel('ProjectCodeWiz AI');
        this.loadConfig();
    }
    // ── Configuration ──────────────────────────────────────────
    loadConfig() {
        const vsConfig = vscode.workspace.getConfiguration('projectcodewiz');
        const provider = vsConfig.get('aiProvider') || 'openai';
        const apiKey = vsConfig.get('aiApiKey') || '';
        const model = vsConfig.get('aiModel') || '';
        if (apiKey) {
            this.config = {
                type: provider,
                apiKey,
                model: model || undefined,
            };
        }
        else {
            this.config = null;
        }
    }
    isConfigured() {
        return this.config !== null && this.config.apiKey.length > 0;
    }
    getProviderLabel() {
        if (!this.config) {
            return 'Not configured';
        }
        const meta = aiProviders_1.PROVIDER_META[this.config.type];
        return `${meta.label} (${this.config.model || meta.defaultModel})`;
    }
    // ── API Key Configuration Flow ─────────────────────────────
    async configureApiKey() {
        // Step 1: Pick provider
        const providers = Object.entries(aiProviders_1.PROVIDER_META).map(([key, meta]) => ({
            label: meta.label,
            description: `Models: ${meta.models.slice(0, 3).join(', ')}`,
            detail: `Get key: ${meta.docUrl}`,
            key: key,
        }));
        const providerPick = await vscode.window.showQuickPick(providers, {
            title: 'ProjectCodeWiz AI — Select Provider',
            placeHolder: 'Choose your AI provider...',
        });
        if (!providerPick) {
            return false;
        }
        const providerKey = providerPick.key;
        const meta = aiProviders_1.PROVIDER_META[providerKey];
        // Step 2: Enter API key
        const apiKey = await vscode.window.showInputBox({
            title: `Enter ${meta.label} API Key`,
            prompt: `Paste your ${meta.label} API key. Get one at: ${meta.docUrl}`,
            placeHolder: meta.placeholder,
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length < 8) {
                    return 'API key seems too short. Please enter a valid key.';
                }
                return null;
            },
        });
        if (!apiKey) {
            return false;
        }
        // Step 3: Pick model
        const modelPick = await vscode.window.showQuickPick(meta.models.map((m, i) => ({
            label: m,
            description: i === 0 ? '(default)' : '',
        })), {
            title: `Select ${meta.label} Model`,
            placeHolder: `Default: ${meta.defaultModel}`,
        });
        const model = modelPick?.label || meta.defaultModel;
        // Step 4: Save to settings
        const vsConfig = vscode.workspace.getConfiguration('projectcodewiz');
        await vsConfig.update('aiProvider', providerKey, vscode.ConfigurationTarget.Global);
        await vsConfig.update('aiApiKey', apiKey.trim(), vscode.ConfigurationTarget.Global);
        await vsConfig.update('aiModel', model, vscode.ConfigurationTarget.Global);
        this.loadConfig();
        // Step 5: Validate
        const validationResult = await this.validateKey();
        if (validationResult.success) {
            vscode.window.showInformationMessage(`✅ ProjectCodeWiz AI: ${meta.label} configured successfully! Model: ${model}`);
        }
        else {
            const errorDetail = validationResult.error || 'Unknown error';
            this.outputChannel.appendLine(`Validation error details: ${errorDetail}`);
            this.outputChannel.show(true);
            const action = await vscode.window.showWarningMessage(`⚠️ ProjectCodeWiz AI: Key saved but validation failed.\n\nReason: ${errorDetail}`, 'View Output Log', 'Keep Key Anyway', 'Try Again');
            if (action === 'View Output Log') {
                this.outputChannel.show(true);
            }
            else if (action === 'Try Again') {
                return this.configureApiKey();
            }
        }
        return true;
    }
    async validateKey() {
        if (!this.config) {
            return { success: false, error: 'No API configuration found' };
        }
        try {
            await this.call([
                { role: 'user', content: 'Reply with exactly: OK' },
            ]);
            return { success: true };
        }
        catch (err) {
            const message = err.message || String(err);
            this.outputChannel.appendLine(`[Validation] Failed: ${message}`);
            // Parse common API error messages into user-friendly hints
            let hint = message;
            if (message.includes('401') || message.includes('Unauthorized') || message.includes('invalid_api_key')) {
                hint = 'Invalid API key. Please double-check the key you pasted.';
            }
            else if (message.includes('429') || message.includes('rate_limit') || message.includes('quota')) {
                hint = 'Rate limit or quota exceeded. Your plan may not have enough credits.';
            }
            else if (message.includes('403') || message.includes('Forbidden')) {
                hint = 'Access forbidden. This key may not have permissions for the selected model.';
            }
            else if (message.includes('insufficient_quota') || message.includes('billing')) {
                hint = 'No billing set up or quota exhausted. Add a payment method at your provider\'s billing page.';
            }
            else if (message.includes('ENOTFOUND') || message.includes('ECONNREFUSED') || message.includes('network')) {
                hint = 'Network error. Check your internet connection.';
            }
            else if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
                hint = 'Request timed out. The API server may be slow or unreachable.';
            }
            return { success: false, error: hint };
        }
    }
    // ── Core Call ──────────────────────────────────────────────
    async call(messages) {
        if (!this.config) {
            throw new Error('AI is not configured. Use the "Configure AI" command to set up your API key.');
        }
        return (0, aiProviders_1.callAI)(this.config, messages);
    }
    // ── Feature: Explain Code ──────────────────────────────────
    async explainCode(code, language, fileName) {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `Explain the following ${language} code from file "${fileName}". 
Provide a clear, structured explanation covering:
1. **Purpose**: What this code does at a high level
2. **Key Components**: Important functions, classes, or variables
3. **Logic Flow**: How the code executes step by step
4. **Notable Patterns**: Any design patterns, algorithms, or techniques used

\`\`\`${language}
${code}
\`\`\``,
            },
        ];
        const response = await this.call(messages);
        this.logUsage('Explain Code', response);
        return response.text;
    }
    // ── Feature: Analyze Errors ────────────────────────────────
    async analyzeErrors(code, language, errors, fileName) {
        const errorList = errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `Analyze the following errors/warnings found in this ${language} code from "${fileName}".

**Detected Issues:**
${errorList}

**Source Code:**
\`\`\`${language}
${code}
\`\`\`

For each error/warning:
1. **What's happening**: Explain the root cause clearly
2. **How to fix it**: Provide the exact fix with corrected code
3. **Why it matters**: Explain the impact if left unfixed

Also identify any **additional issues** you notice that weren't caught by the static analyzer.`,
            },
        ];
        const response = await this.call(messages);
        this.logUsage('Analyze Errors', response);
        return response.text;
    }
    // ── Feature: Suggest Improvements ──────────────────────────
    async suggestImprovements(code, language, fileName) {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `Analyze the following ${language} code from "${fileName}" and suggest improvements.

\`\`\`${language}
${code}
\`\`\`

Provide suggestions in these categories:
1. 🚀 **Performance**: Optimizations to make the code faster or use less memory
2. 🧹 **Code Quality**: Better naming, structure, readability improvements
3. 🛡️ **Error Handling**: Missing error handling, edge cases, input validation
4. 🔒 **Security**: Potential security issues (if applicable)
5. 📐 **Best Practices**: Language-specific idioms and conventions
6. ♻️ **Refactoring**: Structural improvements, DRY violations, SOLID principles

For each suggestion, show the improved code snippet and explain why it's better.
Rate the overall code quality on a scale of 1-10.`,
            },
        ];
        const response = await this.call(messages);
        this.logUsage('Suggest Improvements', response);
        return response.text;
    }
    // ── Feature: Hover Description ─────────────────────────────
    async getHoverDescription(code, language, symbolName) {
        const messages = [
            { role: 'system', content: `${SYSTEM_PROMPT}\nBe very concise — max 3-4 sentences. This appears in a hover tooltip.` },
            {
                role: 'user',
                content: `Briefly explain what "${symbolName}" does in this ${language} code. Focus on its purpose and how it's used.

\`\`\`${language}
${code}
\`\`\``,
            },
        ];
        const response = await this.call(messages);
        this.logUsage('Hover Description', response);
        return response.text;
    }
    // ── Feature: Full Code Insights ────────────────────────────
    async getCodeInsights(code, language, fileName) {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `Provide comprehensive insights for this ${language} code from "${fileName}":

\`\`\`${language}
${code}
\`\`\`

Analyze the following aspects:

## 📊 Code Metrics
- Complexity assessment (simple/moderate/complex)
- Estimated maintainability score (1-10)
- Number of potential issues found

## 🔍 Code Analysis
- Purpose and functionality overview
- Key dependencies and coupling
- Error-prone areas

## ⚡ Performance Assessment
- Any O(n²) or worse algorithms?
- Memory usage patterns
- Potential bottlenecks

## 🎯 Actionable Recommendations
- Top 3 priority improvements
- Quick wins (easy to implement)
- Long-term refactoring suggestions`,
            },
        ];
        const response = await this.call(messages);
        this.logUsage('Code Insights', response);
        return response.text;
    }
    // ── Logging ────────────────────────────────────────────────
    logUsage(feature, response) {
        const tokens = response.tokensUsed ? ` (${response.tokensUsed} tokens)` : '';
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ${feature} — ${response.provider}/${response.model}${tokens}`);
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.AIService = AIService;

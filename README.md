# ProjectCodeWiz

> Interactive multi-language code structure visualization with AI-powered analysis for Visual Studio Code

**Developer:** GaryDaVinci  
**Version:** 1.4.0

---

## ✨ What's New in v1.4.0 — AI-Powered Code Intelligence

- 🧠 **AI Integration** — Connect your own API key (OpenAI, Gemini, Claude, Mistral, Cohere, Groq)
- 📖 **AI Code Explanations** — Select code and get detailed explanations of what it does
- 🔍 **AI Error Analysis** — AI parses errors, explains root causes, and suggests exact fixes
- 🚀 **AI Improvement Suggestions** — Get performance, security, and code quality suggestions with ratings
- 📊 **AI Code Insights** — Full code analysis with complexity metrics and actionable recommendations
- 🖱️ **AI Hover Descriptions** — Hover over any symbol to get an AI-generated explanation
- 🧠 **Graph AI Analyze** — Click any node in the visualization graph and analyze it with AI
- 🔌 **6 AI Providers** — OpenAI, Google Gemini, Anthropic Claude, Mistral, Cohere, and Groq
- 🔑 **Guided API Key Setup** — Interactive wizard to configure your preferred AI provider

---

## Features

### Code Visualization
- 🌐 **Multi-language support** — C/C++, Python, Java, JavaScript, and TypeScript
- 🔍 **Auto language detection** — Automatically detects language from file extensions
- 🔍 **Workspace scanning** — Recursively finds all supported source files
- 🌳 **AST-based parsing** — Extracts classes, functions, variables, objects, and import/include relationships
- 🕸️ **Interactive graph** — Rendered with Cytoscape.js inside a VS Code Webview
- 💬 **@viz comments** — Attach custom descriptions to nodes via inline comments
- 🔴 **Error detection** — Multi-language error detection with Clang support for C++ and regex-based analysis for all languages
- 🔗 **Trace mode** — Follow the full dependency chain from any node
- 📁 **File view / Code view** — Switch between file-dependency and full code graph
- 🔎 **Search & filter** — Find and show/hide node types instantly
- 📤 **Export** — Save graph as PNG or JSON
- 🏷️ **Language badges** — Visual language indicators on nodes and in detail panels

### AI-Powered Analysis (NEW in v1.4.0)
- 🧠 **AI Explain Code** — Select code → get a structured explanation (purpose, components, logic flow, patterns)
- 🔍 **AI Analyze Errors** — Combines VS Code diagnostics + custom detection → AI explains root causes and provides fixes
- 🚀 **AI Suggest Improvements** — Get categorized suggestions: performance, code quality, error handling, security, best practices, refactoring
- 📊 **AI Code Insights** — Full file analysis with complexity assessment, maintainability score, and priority recommendations
- 🖱️ **AI Hover** — Hover over symbols for quick AI-powered descriptions (with intelligent caching)
- 🧠 **Graph AI Analyze** — Click "AI Analyze" button in the visualization to analyze any node directly

---

## Supported AI Providers

| Provider | Models | Get API Key |
|----------|--------|-------------|
| **OpenAI** | GPT-4o, GPT-4o-mini, GPT-4 Turbo, GPT-3.5 Turbo, o1-mini | [platform.openai.com](https://platform.openai.com/api-keys) |
| **Google Gemini** | Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| **Mistral AI** | Mistral Large, Medium, Small, Open Mistral 7B | [console.mistral.ai](https://console.mistral.ai/api-keys/) |
| **Cohere** | Command R+, Command R, Command Light | [dashboard.cohere.com](https://dashboard.cohere.com/api-keys) |
| **Groq** | Llama 3.1 70B, Llama 3.1 8B, Mixtral 8x7B | [console.groq.com](https://console.groq.com/keys) |

---

## Quick Start: Setting Up AI

1. Open Command Palette: `Ctrl+Shift+P`
2. Run: `ProjectCodeWiz: Configure AI Provider & API Key`
3. Select your preferred AI provider
4. Paste your API key
5. Choose a model
6. Done! AI features are now active ✅

Or manually set in VS Code Settings:
```json
{
  "projectcodewiz.aiProvider": "gemini",
  "projectcodewiz.aiApiKey": "your-api-key-here",
  "projectcodewiz.aiModel": "gemini-2.0-flash"
}
```

---

## Supported Languages

| Language | Extensions | Parser Features |
|----------|-----------|-----------------|
| **C/C++** | `.cpp`, `.cc`, `.cxx`, `.c`, `.h`, `.hpp`, `.hxx` | Classes, structs, functions, variables, `#include`, inheritance, object instantiation |
| **Python** | `.py`, `.pyw` | Classes, functions/methods, module variables, `import`/`from`, decorators, inheritance |
| **Java** | `.java` | Classes, interfaces, enums, methods, fields, `import`, annotations, inheritance (`extends`/`implements`) |
| **JavaScript/TypeScript** | `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs` | Classes, functions, arrow functions, `import`/`require`, class methods, variables, inheritance |

---

## Usage

### Trigger Visualization

Five ways to start:

1. **Status bar button** — Click `$(graph) Visualize` in the bottom status bar
2. **Command palette** — `Ctrl+Shift+P` → `ProjectCodeWiz: Visualize`
3. **Keyboard shortcut** — `Ctrl+Shift+V` (Windows/Linux) / `Cmd+Shift+V` (Mac)
4. **Editor title button** — When a supported file is open, click the graph icon in the editor title bar
5. **Explorer context menu** — Right-click any file/folder → `ProjectCodeWiz: Visualize`

### AI Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `ProjectCodeWiz: AI: Explain Code` | `Ctrl+Shift+E` | Explain selected code or entire file |
| `ProjectCodeWiz: AI: Analyze Errors & Fix` | `Ctrl+Shift+D` | AI-powered error analysis with fixes |
| `ProjectCodeWiz: AI: Suggest Improvements` | `Ctrl+Shift+I` | Get improvement suggestions with code quality rating |
| `ProjectCodeWiz: AI: Full Code Insights` | — | Complete code analysis with metrics |
| `ProjectCodeWiz: Configure AI Provider & API Key` | — | Set up your AI provider and API key |

### Right-Click Context Menu

Right-click in any supported file to access the **🧠 ProjectCodeWiz AI** submenu with all AI features.

### Graph AI Analysis

In the visualization graph:
- Select any node → Click **🧠 AI Analyze** in the header
- Or click **📖 AI: Explain This Code** in the detail panel
- Nodes with errors show **🧠 AI: Explain & Fix Errors** button

---

## @viz Comment Syntax

Add custom descriptions to your code using inline `@viz:` comments:

```cpp
class UserService {};          // @viz: Handles authentication
void login() {}                // @viz: Authenticates user
Database db;                   // @viz: Main database instance
```

```python
class UserService:             # @viz: Handles authentication
    def login(self):           # @viz: Authenticates user
```

```java
class UserService {            // @viz: Handles authentication
    void login() {}            // @viz: Authenticates user
}
```

```javascript
class UserService {            // @viz: Handles authentication
    login() {}                 // @viz: Authenticates user
}
```

**Rules:**
- Must be on the SAME LINE as the declaration
- Must start with `@viz:` (case-sensitive)
- Use `//` for C++/Java/JS/TS, `#` for Python

---

## Configuration

Open VS Code Settings (`Ctrl+,`) and search for `ProjectCodeWiz`:

| Setting | Default | Description |
|---------|---------|-------------|
| `projectcodewiz.ignorePaths` | `["node_modules","build","dist",".git","out","bin","obj"]` | Directories to skip |
| `projectcodewiz.clangPath` | `"clang"` | Path to clang executable (for C++ error detection) |
| `projectcodewiz.maxFileSizeKB` | `500` | Max file size to parse (KB) |
| `projectcodewiz.aiProvider` | `"openai"` | AI provider (`openai`, `gemini`, `anthropic`, `mistral`, `cohere`, `groq`) |
| `projectcodewiz.aiApiKey` | `""` | API key for the selected AI provider |
| `projectcodewiz.aiModel` | `""` | AI model (leave empty for provider default) |
| `projectcodewiz.aiHoverEnabled` | `true` | Enable/disable AI hover descriptions |

---

## Node Types & Colors

| Type | Shape | Color |
|------|-------|-------|
| Class | Oval (ellipse) | 🟢 Green |
| Object | Oval (ellipse) | 🔵 Blue |
| Function | Rounded Rectangle | 🟡 Orange/Amber |
| Variable | Cut Rectangle | 🔷 Blue |
| File | Diamond | 🟣 Purple |

---

## Error Detection

ProjectCodeWiz includes multi-language error detection:

### C/C++
- Uses `clang -fsyntax-only` if clang is installed
- Falls back to regex-based analysis (brace/parenthesis matching)

### Python
- Indentation consistency checks
- Missing colons on `class`/`def`/`if`/`for`/`while` statements
- Parenthesis and bracket matching
- Keyword assignment detection

### Java
- Brace and parenthesis matching
- Basic syntax validation

### JavaScript/TypeScript
- Brace, parenthesis, and bracket matching
- `var` usage warnings (suggests `const`/`let`)
- Loose equality (`==`) warnings (suggests `===`)

### Error Display
- **Red border** = node has errors
- **Orange border** = node has warnings
- **Dashed red edge** = connected to an errored node
- **Tooltip** shows error/warning details with line numbers
- **Detail panel** separates errors and warnings into distinct sections
- **🧠 AI Fix** button appears on error nodes for AI-powered resolution

---

## Changelog

### v1.4.0 — AI-Powered Code Intelligence
- 🧠 AI integration with 6 providers (OpenAI, Gemini, Claude, Mistral, Cohere, Groq)
- 📖 AI Code Explanations for selected code or entire files
- 🔍 AI Error Analysis with root cause identification and fix suggestions
- 🚀 AI Improvement Suggestions with code quality scoring (1-10)
- 📊 AI Code Insights with complexity metrics and actionable recommendations
- 🖱️ AI Hover Descriptions with smart caching
- 🧠 Graph AI Analyze button for direct node analysis from visualization
- 🔌 Right-click context submenu for all AI features
- ⌨️ New keyboard shortcuts: `Ctrl+Shift+E` (Explain), `Ctrl+Shift+D` (Errors), `Ctrl+Shift+I` (Improve)
- 🔑 Interactive API key configuration wizard
- 📊 AI status bar indicator showing active provider

### v1.2.0 — Multi-Language Support
- ✨ Added Python, Java, JavaScript, and TypeScript language support
- 🔍 Auto-detection of language from file extensions
- 🛠️ Universal error detection for all supported languages
- 🏷️ Language badges displayed on nodes and in detail panels
- ⚠️ Separate error and warning display in tooltips and detail panels
- 📊 Language breakdown shown in the result notification
- 🗑️ Removed tree-sitter dependency (pure regex-based parsing)

### v1.0.0 — Initial Release
- C++ code visualization
- Cytoscape.js interactive graph
- @viz comment support
- Error detection with Clang

---

## Requirements

- VS Code 1.74+
- Node.js 18+ (for extension development)
- `clang` (optional, for enhanced C++ error detection — install via your OS package manager)
- AI API key (optional, for AI features — get from your preferred provider)

## Contributors
Aditya Gawali    
Atharva Ghule

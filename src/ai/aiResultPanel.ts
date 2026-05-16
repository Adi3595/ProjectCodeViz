import * as vscode from 'vscode';

// ============================================================
// AI Result Panel — Beautiful webview for displaying AI output
// ============================================================

export class AIResultPanel {
  public static currentPanel: AIResultPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static show(
    context: vscode.ExtensionContext,
    title: string,
    content: string,
    providerLabel: string,
    featureIcon: string
  ) {
    const column = vscode.ViewColumn.Beside;

    if (AIResultPanel.currentPanel) {
      AIResultPanel.currentPanel._panel.reveal(column);
      AIResultPanel.currentPanel.update(title, content, providerLabel, featureIcon);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'projectCodeWizAI',
      `🧠 ${title}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    AIResultPanel.currentPanel = new AIResultPanel(panel, title, content, providerLabel, featureIcon);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    title: string,
    content: string,
    providerLabel: string,
    featureIcon: string
  ) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this.getHtml(title, content, providerLabel, featureIcon);
  }

  public update(title: string, content: string, providerLabel: string, featureIcon: string) {
    this._panel.title = `🧠 ${title}`;
    this._panel.webview.html = this.getHtml(title, content, providerLabel, featureIcon);
  }

  private getHtml(title: string, content: string, providerLabel: string, featureIcon: string): string {
    // Convert markdown-like content to HTML
    const htmlContent = this.markdownToHtml(content);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${this.escHtml(title)}</title>
  <style>
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --surface2: #21262d;
      --border: #30363d;
      --accent: #58a6ff;
      --accent-glow: rgba(88, 166, 255, 0.15);
      --text: #e6edf3;
      --text-muted: #8b949e;
      --green: #3fb950;
      --orange: #d29922;
      --red: #f85149;
      --purple: #bc8cff;
      --teal: #39d353;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      line-height: 1.7;
      padding: 0;
      overflow-x: hidden;
    }

    /* ── Header ────────────────────────────── */
    .header {
      background: linear-gradient(135deg, rgba(88,166,255,0.08) 0%, rgba(188,140,255,0.08) 100%);
      border-bottom: 1px solid var(--border);
      padding: 24px 32px;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(12px);
    }

    .header-top {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .header-icon {
      font-size: 28px;
      filter: drop-shadow(0 0 8px rgba(88,166,255,0.4));
    }

    .header-title {
      font-size: 22px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent), var(--purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header-meta {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 12px;
      color: var(--text-muted);
    }

    .provider-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      color: var(--accent);
    }

    .provider-badge::before {
      content: '⚡';
      font-size: 10px;
    }

    .brand-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      background: rgba(63,185,80,0.1);
      border: 1px solid rgba(63,185,80,0.2);
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      color: var(--green);
    }

    /* ── Content ───────────────────────────── */
    .content {
      padding: 28px 32px 60px;
      max-width: 820px;
    }

    .content h1 {
      font-size: 24px;
      font-weight: 700;
      color: var(--text);
      margin: 28px 0 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }

    .content h2 {
      font-size: 18px;
      font-weight: 700;
      color: var(--accent);
      margin: 24px 0 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .content h3 {
      font-size: 15px;
      font-weight: 600;
      color: var(--purple);
      margin: 18px 0 8px;
    }

    .content p {
      margin: 8px 0;
      color: var(--text);
    }

    .content ul, .content ol {
      margin: 8px 0;
      padding-left: 24px;
    }

    .content li {
      margin: 4px 0;
      color: var(--text);
    }

    .content li::marker {
      color: var(--accent);
    }

    .content strong {
      color: var(--text);
      font-weight: 700;
    }

    .content em {
      color: var(--text-muted);
    }

    /* ── Code Blocks ──────────────────────── */
    .content pre {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin: 12px 0;
      overflow-x: auto;
      font-size: 13px;
      line-height: 1.6;
      position: relative;
    }

    .content pre::before {
      content: attr(data-lang);
      position: absolute;
      top: 6px;
      right: 10px;
      font-size: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }

    .content code {
      font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
      font-size: 13px;
    }

    .content p code, .content li code {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1px 6px;
      font-size: 12px;
      color: var(--orange);
    }

    /* ── Blockquotes / Tips ────────────────── */
    .content blockquote {
      border-left: 3px solid var(--accent);
      background: var(--accent-glow);
      margin: 12px 0;
      padding: 10px 16px;
      border-radius: 0 6px 6px 0;
      color: var(--text-muted);
    }

    /* ── Horizontal Rules ─────────────────── */
    .content hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 20px 0;
    }

    /* ── Score / Rating ────────────────────── */
    .score-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 14px;
    }

    /* ── Animations ────────────────────────── */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .content > * {
      animation: fadeIn 0.3s ease-out both;
    }

    .content > *:nth-child(1) { animation-delay: 0.05s; }
    .content > *:nth-child(2) { animation-delay: 0.1s; }
    .content > *:nth-child(3) { animation-delay: 0.15s; }
    .content > *:nth-child(4) { animation-delay: 0.2s; }
    .content > *:nth-child(5) { animation-delay: 0.25s; }
    .content > *:nth-child(n+6) { animation-delay: 0.3s; }

    /* ── Scrollbar ─────────────────────────── */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

    /* ── Copy Button ──────────────────────── */
    .copy-btn {
      position: absolute;
      top: 6px;
      right: 60px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text-muted);
      font-size: 11px;
      padding: 2px 8px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s, background 0.15s;
    }

    pre:hover .copy-btn { opacity: 1; }
    .copy-btn:hover { background: var(--border); color: var(--text); }
    .copy-btn.copied { color: var(--green); }
  </style>
</head>
<body>

<div class="header">
  <div class="header-top">
    <span class="header-icon">${featureIcon}</span>
    <span class="header-title">${this.escHtml(title)}</span>
  </div>
  <div class="header-meta">
    <span class="brand-tag">🧙 ProjectCodeWiz v1.8.5</span>
    <span class="provider-badge">${this.escHtml(providerLabel)}</span>
    <span>Generated ${new Date().toLocaleTimeString()}</span>
  </div>
</div>

<div class="content">
  ${htmlContent}
</div>

<script>
  // Copy code buttons
  document.querySelectorAll('pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code')?.textContent || pre.textContent;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = '✓ Copied';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    });
    pre.style.position = 'relative';
    pre.appendChild(btn);
  });
</script>

</body>
</html>`;
  }

  private markdownToHtml(md: string): string {
    let html = md;

    // Code blocks with language
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre data-lang="${this.escHtml(lang)}"><code>${this.escHtml(code.trim())}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // Unordered lists
    html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => {
      if (!match.startsWith('<ul>')) {
        return `<ul>${match}</ul>`;
      }
      return match;
    });

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr />');

    // Paragraphs — wrap remaining lines
    html = html.replace(/^(?!<[a-z/])((?!<).+)$/gm, '<p>$1</p>');

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    // Fix nested ul/li
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    return html;
  }

  private escHtml(s: string): string {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  public dispose() {
    AIResultPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) { x.dispose(); }
    }
  }
}

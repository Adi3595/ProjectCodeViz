import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ClangError } from '../models';
import { detectLanguage, SupportedLanguage } from '../parser/workspaceScanner';

const execAsync = promisify(exec);

/**
 * Universal error detector that performs language-aware static analysis.
 * v1.8.0 — Major rewrite to eliminate false positives:
 *   - Unknown files are skipped (no longer default to C++ analysis)
 *   - Python: proper multi-line handling, word-boundary keyword checks
 *   - C++ fallback: much more conservative semicolon heuristic
 *   - JS/TS: proper string-aware checks, fixed equality logic
 *   - All languages: better comment/string stripping
 */
export class ErrorDetector {
  private clangPath: string;

  constructor(clangPath: string = 'clang') {
    this.clangPath = clangPath;
  }

  async analyzeFiles(files: string[]): Promise<Map<string, ClangError[]>> {
    const errorMap = new Map<string, ClangError[]>();

    // Group files by language — SKIP files with unknown language
    const filesByLang = new Map<SupportedLanguage, string[]>();
    for (const file of files) {
      const lang = detectLanguage(file);
      if (!lang) {
        // Unknown file type — do NOT analyze (was previously defaulting to 'cpp')
        continue;
      }
      if (!filesByLang.has(lang)) { filesByLang.set(lang, []); }
      filesByLang.get(lang)!.push(file);
    }

    // Process each language group
    for (const [lang, langFiles] of filesByLang) {
      const batchSize = 5;
      for (let i = 0; i < langFiles.length; i += batchSize) {
        const batch = langFiles.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async file => {
            try {
              const errors = await this.analyzeFile(file, lang);
              if (errors.length > 0) {
                errorMap.set(file, errors);
              }
            } catch (err) {
              console.warn(`Error analyzing ${file}:`, err);
            }
          })
        );
      }
    }

    return errorMap;
  }

  private async analyzeFile(filePath: string, language: SupportedLanguage): Promise<ClangError[]> {
    switch (language) {
      case 'cpp':
        return this.analyzeCpp(filePath);
      case 'python':
        return this.analyzePython(filePath);
      case 'java':
        return this.analyzeJava(filePath);
      case 'javascript':
        return this.analyzeJavaScript(filePath);
      default:
        return [];
    }
  }

  // ─── C/C++ Analysis ─────────────────────────────────────────
  private async analyzeCpp(filePath: string): Promise<ClangError[]> {
    const clangAvailable = await this.isClangAvailable();
    if (clangAvailable) {
      return this.analyzeWithClang(filePath);
    }
    return this.analyzeCppFallback(filePath);
  }

  private async analyzeWithClang(filePath: string): Promise<ClangError[]> {
    try {
      const cmd = `"${this.clangPath}" -fsyntax-only "${filePath}" 2>&1`;
      const { stdout, stderr } = await execAsync(cmd, { timeout: 15000 });
      const output = stdout + stderr;
      return this.parseClangOutput(output, filePath);
    } catch (err: any) {
      const output = (err.stdout || '') + (err.stderr || '');
      return this.parseClangOutput(output, filePath);
    }
  }

  private parseClangOutput(output: string, filePath: string): ClangError[] {
    const errors: ClangError[] = [];
    const lines = output.split('\n');
    const errorRegex = /^(.+?):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$/;

    for (const line of lines) {
      const match = line.match(errorRegex);
      if (match) {
        errors.push({
          file: filePath,
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          severity: match[4] as 'error' | 'warning' | 'note',
          message: match[5].trim(),
        });
      }
    }

    return errors.filter(e => e.severity === 'error' || e.severity === 'warning');
  }

  /**
   * C++ fallback when clang is not installed.
   * CONSERVATIVE — only reports high-confidence structural issues.
   */
  private async analyzeCppFallback(filePath: string): Promise<ClangError[]> {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const errors: ClangError[] = [];

    let braceCount = 0;
    let parenCount = 0;
    let inMultilineComment = false;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Handle multi-line comments
      if (inMultilineComment) {
        const endIdx = line.indexOf('*/');
        if (endIdx >= 0) { inMultilineComment = false; line = line.substring(endIdx + 2); }
        else { continue; }
      }
      const startIdx = line.indexOf('/*');
      if (startIdx >= 0) {
        const endIdx = line.indexOf('*/', startIdx + 2);
        if (endIdx < 0) { inMultilineComment = true; line = line.substring(0, startIdx); }
        else { line = line.substring(0, startIdx) + line.substring(endIdx + 2); }
      }

      // Strip single-line comments (but not inside strings)
      const commentIdx = this.findCommentStart(line, '//');
      if (commentIdx >= 0) { line = line.substring(0, commentIdx); }

      const trimmed = line.trim();
      if (!trimmed) { continue; }

      // Count braces/parens (outside of strings)
      const stripped = this.stripStrings(trimmed);
      braceCount += (stripped.match(/\{/g) || []).length - (stripped.match(/\}/g) || []).length;
      parenCount += (stripped.match(/\(/g) || []).length - (stripped.match(/\)/g) || []).length;

      // REMOVED: aggressive "Possible missing semicolon" heuristic
      // It produced too many false positives on multi-line expressions,
      // macro continuations, and was misapplied to non-C++ files.
    }

    if (braceCount !== 0) {
      errors.push({ file: filePath, line: lines.length, column: 0, severity: 'error', message: `Mismatched braces: ${braceCount > 0 ? braceCount + ' unclosed' : Math.abs(braceCount) + ' extra closing'}` });
    }

    if (parenCount !== 0) {
      errors.push({ file: filePath, line: lines.length, column: 0, severity: 'error', message: `Mismatched parentheses: ${parenCount > 0 ? parenCount + ' unclosed' : Math.abs(parenCount) + ' extra closing'}` });
    }

    return errors;
  }

  // ─── Python Analysis ────────────────────────────────────────
  /**
   * Python error detection — v1.8.0 fixes:
   * - Multi-line expressions (parens/brackets) are properly tracked
   * - Colon check skips lines inside multi-line conditions
   * - Keyword assignment uses word boundaries (\b) to avoid false matches
   * - Indentation check is more lenient (only flags truly odd indents)
   */
  private async analyzePython(filePath: string): Promise<ClangError[]> {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const errors: ClangError[] = [];

    let inMultilineStr = false;
    let parenCount = 0;
    let bracketCount = 0;
    let braceCount = 0;
    let detectedIndentUnit = 0; // auto-detect: 2 or 4

    // First pass: detect the project's indentation unit
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) { continue; }
      const indent = line.length - line.trimStart().length;
      if (indent > 0) {
        if (indent === 4 || indent === 2) {
          detectedIndentUnit = indent;
          break;
        }
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Handle triple-quoted strings — count non-escaped triple quotes
      const tripleDoubleCount = (line.match(/"""/g) || []).length;
      const tripleSingleCount = (line.match(/'''/g) || []).length;
      const totalTriple = tripleDoubleCount + tripleSingleCount;
      if (totalTriple % 2 !== 0) { inMultilineStr = !inMultilineStr; }
      if (inMultilineStr) { continue; }

      if (!trimmed || trimmed.startsWith('#')) { continue; }

      // Track bracket depths (for multi-line expression awareness)
      const strippedLine = this.stripPythonStrings(trimmed);
      parenCount += (strippedLine.match(/\(/g) || []).length - (strippedLine.match(/\)/g) || []).length;
      bracketCount += (strippedLine.match(/\[/g) || []).length - (strippedLine.match(/\]/g) || []).length;
      braceCount += (strippedLine.match(/\{/g) || []).length - (strippedLine.match(/\}/g) || []).length;

      const insideMultilineExpr = parenCount > 0 || bracketCount > 0 || braceCount > 0;

      // ── Indentation check ──
      // Only flag if we detected a consistent indent unit AND the line
      // is at the top level (not inside multi-line expressions)
      if (!insideMultilineExpr && detectedIndentUnit > 0) {
        const indent = line.length - line.trimStart().length;
        if (indent > 0 && indent % detectedIndentUnit !== 0) {
          // Double-check: is this a continuation line? (prev line ends with \)
          const prevTrimmed = i > 0 ? lines[i - 1].trim() : '';
          if (!prevTrimmed.endsWith('\\') && !prevTrimmed.endsWith(',')) {
            errors.push({ file: filePath, line: i + 1, column: 1, severity: 'warning', message: `Inconsistent indentation (${indent} spaces, expected multiple of ${detectedIndentUnit})` });
          }
        }
      }

      // ── Missing colon on block statements ──
      // Only check when NOT inside a multi-line expression
      if (!insideMultilineExpr && !trimmed.endsWith('\\')) {
        const blockMatch = trimmed.match(/^(class|def|if|elif|else|for|while|with|try|except|finally)\b/);
        if (blockMatch) {
          const keyword = blockMatch[1];
          // 'else', 'try', 'finally' should always end with ':'
          // Others might have conditions, but must still end with ':'
          if (!trimmed.endsWith(':') && !trimmed.endsWith(':\\')) {
            // Check: is the NEXT non-empty line indented further? If so, colon is truly missing.
            // If not, this might be a comment or standalone keyword usage.
            let nextNonEmpty = '';
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
              if (lines[j].trim()) { nextNonEmpty = lines[j]; break; }
            }
            const currentIndent = line.length - line.trimStart().length;
            const nextIndent = nextNonEmpty ? nextNonEmpty.length - nextNonEmpty.trimStart().length : 0;

            if (nextIndent > currentIndent) {
              errors.push({ file: filePath, line: i + 1, column: trimmed.length, severity: 'error', message: `Missing colon after '${keyword}' statement` });
            }
          }
        }
      }

      // ── Invalid assignment to keyword ──
      // Use word boundary \b so "class_name = ..." does NOT match
      if (trimmed.match(/^(True|False|None)\s*=[^=]/) ||
          trimmed.match(/^(and|or|not|in|is)\s*=[^=]/) ||
          trimmed.match(/^(return|import|from|if|else|elif|for|while|break|continue|pass|raise|yield|try|except|finally|with|lambda|global|nonlocal|assert|del|class|def)\s*=[^=]/)) {
        // Make sure the matched word IS the entire first token (not a prefix)
        const firstToken = trimmed.split(/\s*=/)[0].trim();
        const keywords = new Set(['True', 'False', 'None', 'and', 'or', 'not', 'in', 'is',
          'return', 'import', 'from', 'if', 'else', 'elif', 'for', 'while', 'break',
          'continue', 'pass', 'raise', 'yield', 'try', 'except', 'finally', 'with',
          'lambda', 'global', 'nonlocal', 'assert', 'del', 'class', 'def']);
        if (keywords.has(firstToken)) {
          errors.push({ file: filePath, line: i + 1, column: 1, severity: 'error', message: `Cannot assign to keyword '${firstToken}'` });
        }
      }
    }

    // Only report bracket mismatches if count is significantly off
    // (small mismatches are often due to string-stripping imperfections)
    if (Math.abs(parenCount) >= 2) {
      errors.push({ file: filePath, line: lines.length, column: 0, severity: 'error', message: `Mismatched parentheses: ${parenCount > 0 ? parenCount + ' unclosed' : Math.abs(parenCount) + ' extra closing'}` });
    }

    if (Math.abs(bracketCount) >= 2) {
      errors.push({ file: filePath, line: lines.length, column: 0, severity: 'error', message: `Mismatched brackets: ${bracketCount > 0 ? bracketCount + ' unclosed' : Math.abs(bracketCount) + ' extra closing'}` });
    }

    return errors;
  }

  // ─── Java Analysis ──────────────────────────────────────────
  private async analyzeJava(filePath: string): Promise<ClangError[]> {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const errors: ClangError[] = [];

    let braceCount = 0;
    let parenCount = 0;
    let inMultilineComment = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      if (inMultilineComment) {
        const endIdx = line.indexOf('*/');
        if (endIdx >= 0) { inMultilineComment = false; line = line.substring(endIdx + 2); }
        else { continue; }
      }
      const startIdx = line.indexOf('/*');
      if (startIdx >= 0) {
        const endIdx = line.indexOf('*/', startIdx + 2);
        if (endIdx < 0) { inMultilineComment = true; line = line.substring(0, startIdx); }
        else { line = line.substring(0, startIdx) + line.substring(endIdx + 2); }
      }
      const commentIdx = this.findCommentStart(line, '//');
      if (commentIdx >= 0) { line = line.substring(0, commentIdx); }

      const trimmed = line.trim();
      if (!trimmed) { continue; }

      // Count only outside strings
      const stripped = this.stripStrings(trimmed);
      braceCount += (stripped.match(/\{/g) || []).length - (stripped.match(/\}/g) || []).length;
      parenCount += (stripped.match(/\(/g) || []).length - (stripped.match(/\)/g) || []).length;
    }

    if (braceCount !== 0) {
      errors.push({ file: filePath, line: lines.length, column: 0, severity: 'error', message: `Mismatched braces: ${braceCount > 0 ? braceCount + ' unclosed' : Math.abs(braceCount) + ' extra closing'}` });
    }

    if (parenCount !== 0) {
      errors.push({ file: filePath, line: lines.length, column: 0, severity: 'error', message: `Mismatched parentheses: ${parenCount > 0 ? parenCount + ' unclosed' : Math.abs(parenCount) + ' extra closing'}` });
    }

    return errors;
  }

  // ─── JavaScript/TypeScript Analysis ─────────────────────────
  /**
   * JS/TS analysis — v1.8.0 fixes:
   * - String-aware bracket counting (won't count brackets inside strings)
   * - Fixed == vs === check (no longer false-positive when === is present)
   * - var check only on actual declarations, not inside strings/comments
   */
  private async analyzeJavaScript(filePath: string): Promise<ClangError[]> {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const errors: ClangError[] = [];

    let braceCount = 0;
    let parenCount = 0;
    let bracketCount = 0;
    let inMultilineComment = false;
    let inTemplateLiteral = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      if (inMultilineComment) {
        const endIdx = line.indexOf('*/');
        if (endIdx >= 0) { inMultilineComment = false; line = line.substring(endIdx + 2); }
        else { continue; }
      }
      const startIdx = line.indexOf('/*');
      if (startIdx >= 0) {
        const endIdx = line.indexOf('*/', startIdx + 2);
        if (endIdx < 0) { inMultilineComment = true; line = line.substring(0, startIdx); }
        else { line = line.substring(0, startIdx) + line.substring(endIdx + 2); }
      }
      const commentIdx = this.findCommentStart(line, '//');
      if (commentIdx >= 0) { line = line.substring(0, commentIdx); }

      const trimmed = line.trim();
      if (!trimmed) { continue; }

      // Template literals — simplified tracking
      const backticks = (trimmed.match(/`/g) || []).length;
      if (backticks % 2 !== 0) { inTemplateLiteral = !inTemplateLiteral; }
      if (inTemplateLiteral) { continue; }

      // Count brackets outside of strings
      const stripped = this.stripStrings(trimmed);
      braceCount += (stripped.match(/\{/g) || []).length - (stripped.match(/\}/g) || []).length;
      parenCount += (stripped.match(/\(/g) || []).length - (stripped.match(/\)/g) || []).length;
      bracketCount += (stripped.match(/\[/g) || []).length - (stripped.match(/\]/g) || []).length;

      // Check for var declarations (only at statement level, not inside strings)
      if (stripped.match(/^\s*var\s+\w/)) {
        errors.push({ file: filePath, line: i + 1, column: 1, severity: 'warning', message: "Consider using 'const' or 'let' instead of 'var'" });
      }

      // Check for loose equality — only flag == when === is NOT on the same line
      // Use proper regex: match == that is NOT preceded/followed by =
      if (stripped.match(/[^=!<>]==[^=]/) && !stripped.match(/[=!]===/)) {
        errors.push({ file: filePath, line: i + 1, column: 1, severity: 'warning', message: "Consider using '===' instead of '==' for strict equality" });
      }
    }

    if (braceCount !== 0) {
      errors.push({ file: filePath, line: lines.length, column: 0, severity: 'error', message: `Mismatched braces: ${braceCount > 0 ? braceCount + ' unclosed' : Math.abs(braceCount) + ' extra closing'}` });
    }

    if (parenCount !== 0) {
      errors.push({ file: filePath, line: lines.length, column: 0, severity: 'error', message: `Mismatched parentheses: ${parenCount > 0 ? parenCount + ' unclosed' : Math.abs(parenCount) + ' extra closing'}` });
    }

    if (bracketCount !== 0) {
      errors.push({ file: filePath, line: lines.length, column: 0, severity: 'error', message: `Mismatched brackets: ${bracketCount > 0 ? bracketCount + ' unclosed' : Math.abs(bracketCount) + ' extra closing'}` });
    }

    return errors;
  }

  // ─── Utility Methods ────────────────────────────────────────

  private async isClangAvailable(): Promise<boolean> {
    try {
      await execAsync(`"${this.clangPath}" --version`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find the start of a line comment, ignoring occurrences inside string literals.
   */
  private findCommentStart(line: string, commentToken: string): number {
    let inStr = false;
    let strChar = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inStr) {
        if (ch === '\\') { i++; continue; } // skip escaped
        if (ch === strChar) { inStr = false; }
      } else {
        if (ch === '"' || ch === "'") { inStr = true; strChar = ch; }
        else if (line.substring(i, i + commentToken.length) === commentToken) {
          return i;
        }
      }
    }
    return -1;
  }

  /**
   * Strip string literals from a line to avoid counting brackets inside strings.
   * Replaces string contents with spaces to preserve positions.
   */
  private stripStrings(line: string): string {
    let result = '';
    let inStr = false;
    let strChar = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inStr) {
        if (ch === '\\') { result += '  '; i++; continue; }
        if (ch === strChar) { inStr = false; result += ch; }
        else { result += ' '; }
      } else {
        if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strChar = ch; result += ch; }
        else { result += ch; }
      }
    }
    return result;
  }

  /**
   * Strip Python string literals — handles both single and double quotes,
   * plus f-strings (treats f"..." same as "...").
   */
  private stripPythonStrings(line: string): string {
    let result = '';
    let inStr = false;
    let strChar = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inStr) {
        if (ch === '\\') { result += '  '; i++; continue; }
        if (ch === strChar) { inStr = false; result += ch; }
        else { result += ' '; }
      } else {
        // Handle f-strings: f"...", f'...', b"...", r"..."
        if ((ch === 'f' || ch === 'b' || ch === 'r' || ch === 'F' || ch === 'B' || ch === 'R') &&
            i + 1 < line.length && (line[i + 1] === '"' || line[i + 1] === "'")) {
          result += ch;
          continue;
        }
        if (ch === '"' || ch === "'") { inStr = true; strChar = ch; result += ch; }
        else { result += ch; }
      }
    }
    return result;
  }
}

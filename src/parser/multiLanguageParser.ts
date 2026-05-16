import * as path from 'path';
import { FileParseResult } from '../models';
import { CppParser } from './cppParser';
import { PythonParser } from './pythonParser';
import { JavaParser } from './javaParser';
import { JavaScriptParser } from './javascriptParser';
import { detectLanguage, SupportedLanguage } from './workspaceScanner';

/**
 * Multi-language parser that auto-detects file language and delegates
 * to the appropriate language-specific parser.
 */
export class MultiLanguageParser {
  private cppParser = new CppParser();
  private pythonParser = new PythonParser();
  private javaParser = new JavaParser();
  private jsParser = new JavaScriptParser();

  async parseFiles(
    files: string[],
    onProgress?: (i: number, total: number, file: string) => void
  ): Promise<FileParseResult[]> {
    const results: FileParseResult[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      onProgress?.(i + 1, files.length, file);
      try {
        const result = await this.parseFile(file);
        results.push(result);
      } catch (err) {
        console.warn(`Failed to parse ${file}:`, err);
      }
    }
    return results;
  }

  async parseFile(filePath: string): Promise<FileParseResult> {
    const language = detectLanguage(filePath);
    switch (language) {
      case 'python':
        return this.pythonParser.parseFile(filePath);
      case 'java':
        return this.javaParser.parseFile(filePath);
      case 'javascript':
        return this.jsParser.parseFile(filePath);
      case 'cpp':
      default:
        return this.cppParser.parseFile(filePath);
    }
  }

  /**
   * Returns a summary of detected languages in the file set.
   */
  static detectLanguages(files: string[]): Map<SupportedLanguage, number> {
    const counts = new Map<SupportedLanguage, number>();
    for (const file of files) {
      const lang = detectLanguage(file);
      if (lang) {
        counts.set(lang, (counts.get(lang) || 0) + 1);
      }
    }
    return counts;
  }
}

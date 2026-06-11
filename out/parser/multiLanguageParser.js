"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiLanguageParser = void 0;
const cppParser_1 = require("./cppParser");
const pythonParser_1 = require("./pythonParser");
const javaParser_1 = require("./javaParser");
const javascriptParser_1 = require("./javascriptParser");
const workspaceScanner_1 = require("./workspaceScanner");
/**
 * Multi-language parser that auto-detects file language and delegates
 * to the appropriate language-specific parser.
 */
class MultiLanguageParser {
    constructor() {
        this.cppParser = new cppParser_1.CppParser();
        this.pythonParser = new pythonParser_1.PythonParser();
        this.javaParser = new javaParser_1.JavaParser();
        this.jsParser = new javascriptParser_1.JavaScriptParser();
    }
    async parseFiles(files, onProgress) {
        const results = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            onProgress?.(i + 1, files.length, file);
            try {
                const result = await this.parseFile(file);
                results.push(result);
            }
            catch (err) {
                console.warn(`Failed to parse ${file}:`, err);
            }
        }
        return results;
    }
    async parseFile(filePath) {
        const language = (0, workspaceScanner_1.detectLanguage)(filePath);
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
    static detectLanguages(files) {
        const counts = new Map();
        for (const file of files) {
            const lang = (0, workspaceScanner_1.detectLanguage)(file);
            if (lang) {
                counts.set(lang, (counts.get(lang) || 0) + 1);
            }
        }
        return counts;
    }
}
exports.MultiLanguageParser = MultiLanguageParser;

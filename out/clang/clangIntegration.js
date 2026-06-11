"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClangIntegration = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ClangIntegration {
    constructor(clangPath = 'clang') {
        this.clangPath = clangPath;
    }
    async analyzeFiles(files) {
        const errorMap = new Map();
        // Check if clang is available
        const available = await this.isClangAvailable();
        if (!available) {
            console.warn('ProjectCodeWiz: clang not found, skipping error detection');
            return errorMap;
        }
        // Process files in batches to avoid overwhelming the system
        const batchSize = 5;
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            await Promise.all(batch.map(async (file) => {
                const errors = await this.analyzeFile(file);
                if (errors.length > 0) {
                    errorMap.set(file, errors);
                }
            }));
        }
        return errorMap;
    }
    async analyzeFile(filePath) {
        try {
            const cmd = `${this.clangPath} -fsyntax-only -w "${filePath}" 2>&1`;
            const { stdout, stderr } = await execAsync(cmd, { timeout: 10000 });
            const output = stdout + stderr;
            return this.parseClangOutput(output, filePath);
        }
        catch (err) {
            // clang returns non-zero exit code on errors, which is expected
            const output = (err.stdout || '') + (err.stderr || '');
            return this.parseClangOutput(output, filePath);
        }
    }
    parseClangOutput(output, filePath) {
        const errors = [];
        const lines = output.split('\n');
        // Pattern: file.cpp:10:5: error: message
        const errorRegex = /^(.+?):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$/;
        for (const line of lines) {
            const match = line.match(errorRegex);
            if (match) {
                errors.push({
                    file: match[1],
                    line: parseInt(match[2], 10),
                    column: parseInt(match[3], 10),
                    severity: match[4],
                    message: match[5].trim(),
                });
            }
        }
        return errors.filter(e => e.severity === 'error');
    }
    async isClangAvailable() {
        try {
            await execAsync(`${this.clangPath} --version`, { timeout: 5000 });
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.ClangIntegration = ClangIntegration;

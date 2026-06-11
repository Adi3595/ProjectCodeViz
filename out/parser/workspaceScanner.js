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
exports.WorkspaceScanner = void 0;
exports.detectLanguage = detectLanguage;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const EXTENSION_LANGUAGE_MAP = {
    // C/C++
    '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.c': 'cpp', '.h': 'cpp', '.hpp': 'cpp', '.hxx': 'cpp',
    // Python
    '.py': 'python', '.pyw': 'python',
    // Java
    '.java': 'java',
    // JavaScript / TypeScript
    '.js': 'javascript', '.jsx': 'javascript', '.ts': 'javascript', '.tsx': 'javascript', '.mjs': 'javascript',
};
function detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return EXTENSION_LANGUAGE_MAP[ext];
}
class WorkspaceScanner {
    constructor(rootPath, ignorePaths, maxFileSizeKB) {
        this.rootPath = rootPath;
        this.ignorePaths = ignorePaths.map(p => p.toLowerCase());
        this.maxFileSizeBytes = maxFileSizeKB * 1024;
        this.supportedExtensions = new Set(Object.keys(EXTENSION_LANGUAGE_MAP));
    }
    async scan() {
        const files = [];
        await this.walkDir(this.rootPath, files);
        return files;
    }
    async walkDir(dir, files) {
        let entries;
        try {
            entries = await fs.promises.readdir(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativeName = entry.name.toLowerCase();
            // Skip hidden directories and ignored paths
            if (entry.name.startsWith('.')) {
                continue;
            }
            if (this.ignorePaths.some(ignore => relativeName === ignore || fullPath.toLowerCase().includes(path.sep + ignore + path.sep))) {
                continue;
            }
            if (entry.isDirectory()) {
                await this.walkDir(fullPath, files);
            }
            else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (this.supportedExtensions.has(ext)) {
                    try {
                        const stat = await fs.promises.stat(fullPath);
                        if (stat.size <= this.maxFileSizeBytes) {
                            files.push(fullPath);
                        }
                    }
                    catch {
                        // skip unreadable files
                    }
                }
            }
        }
    }
}
exports.WorkspaceScanner = WorkspaceScanner;

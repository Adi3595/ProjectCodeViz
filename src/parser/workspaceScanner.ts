import * as fs from 'fs';
import * as path from 'path';

export type SupportedLanguage = 'cpp' | 'python' | 'java' | 'javascript';

const EXTENSION_LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  // C/C++
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.c': 'cpp', '.h': 'cpp', '.hpp': 'cpp', '.hxx': 'cpp',
  // Python
  '.py': 'python', '.pyw': 'python',
  // Java
  '.java': 'java',
  // JavaScript / TypeScript
  '.js': 'javascript', '.jsx': 'javascript', '.ts': 'javascript', '.tsx': 'javascript', '.mjs': 'javascript',
};

export function detectLanguage(filePath: string): SupportedLanguage | undefined {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_LANGUAGE_MAP[ext];
}

export class WorkspaceScanner {
  private rootPath: string;
  private ignorePaths: string[];
  private maxFileSizeBytes: number;
  private supportedExtensions: Set<string>;

  constructor(rootPath: string, ignorePaths: string[], maxFileSizeKB: number) {
    this.rootPath = rootPath;
    this.ignorePaths = ignorePaths.map(p => p.toLowerCase());
    this.maxFileSizeBytes = maxFileSizeKB * 1024;
    this.supportedExtensions = new Set(Object.keys(EXTENSION_LANGUAGE_MAP));
  }

  async scan(): Promise<string[]> {
    const files: string[] = [];
    await this.walkDir(this.rootPath, files);
    return files;
  }

  private async walkDir(dir: string, files: string[]): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativeName = entry.name.toLowerCase();

      // Skip hidden directories and ignored paths
      if (entry.name.startsWith('.')) { continue; }
      if (this.ignorePaths.some(ignore => relativeName === ignore || fullPath.toLowerCase().includes(path.sep + ignore + path.sep))) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.walkDir(fullPath, files);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (this.supportedExtensions.has(ext)) {
          try {
            const stat = await fs.promises.stat(fullPath);
            if (stat.size <= this.maxFileSizeBytes) {
              files.push(fullPath);
            }
          } catch {
            // skip unreadable files
          }
        }
      }
    }
  }
}

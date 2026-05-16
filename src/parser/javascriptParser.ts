import * as fs from 'fs';
import * as path from 'path';
import { FileParseResult, ParsedEntity, ParsedRelationship } from '../models';

export class JavaScriptParser {
  async parseFile(filePath: string): Promise<FileParseResult> {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const fileId = `file::${path.basename(filePath)}`;
    const entities: ParsedEntity[] = [];
    const relationships: ParsedRelationship[] = [];
    const imports: string[] = [];

    const isTS = /\.tsx?$/.test(filePath);
    entities.push({ id: fileId, name: path.basename(filePath), type: 'file', file: filePath, line: 0, metadata: { path: filePath, language: isTS ? 'typescript' : 'javascript' } });

    const classRegex = /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{?/;
    const funcRegex = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/;
    const arrowRegex = /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/;
    const methodRegex = /^\s*(?:async\s+)?(?:static\s+)?(?:get\s+|set\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*\S+)?\s*\{/;
    const importRegex = /^\s*import\s+(?:(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/;
    const requireRegex = /(?:const|let|var)\s+(?:\{[^}]*\}|\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/;
    const varRegex = /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(.+)/;

    const classStack: Array<{ id: string; name: string }> = [];
    let braceDepth = 0;
    let currentClass: { id: string; name: string } | null = null;
    const classNames = new Set<string>();
    const funcNames = new Set<string>();

    // First pass: collect class names
    for (const line of lines) { const cm = line.match(classRegex); if (cm) { classNames.add(cm[1]); } }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const vizMatch = line.match(/\/\/\s*@viz:\s*(.+)$/);
      const vizDesc = vizMatch ? vizMatch[1].trim() : undefined;

      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed === '') { continue; }

      // Imports
      const impMatch = trimmed.match(importRegex);
      if (impMatch) { imports.push(impMatch[1]); continue; }
      const reqMatch = trimmed.match(requireRegex);
      if (reqMatch) { imports.push(reqMatch[1]); continue; }

      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;

      // Class
      const classMatch = line.match(classRegex);
      if (classMatch) {
        const className = classMatch[1];
        const baseClasses: string[] = [];
        if (classMatch[2]) { baseClasses.push(classMatch[2]); }
        if (classMatch[3]) { classMatch[3].split(',').map(s => s.trim()).filter(Boolean).forEach(s => baseClasses.push(s)); }

        const classId = `${fileId}::${className}`;
        entities.push({ id: classId, name: className, type: 'class', file: filePath, line: i + 1, parentId: currentClass ? currentClass.id : fileId, metadata: { kind: 'class', baseClasses, language: isTS ? 'typescript' : 'javascript' }, customDescription: vizDesc });
        relationships.push({ fromId: currentClass ? currentClass.id : fileId, toId: classId, relation: 'contains' });
        for (const base of baseClasses) { relationships.push({ fromId: classId, toId: this.findClassId(base, entities, fileId), relation: 'inherits' }); }

        classStack.push({ id: classId, name: className });
        currentClass = classStack[classStack.length - 1];
        braceDepth += openBraces - closeBraces;
        continue;
      }

      braceDepth += openBraces - closeBraces;
      if (classStack.length > 0 && braceDepth <= 0) { classStack.pop(); currentClass = classStack.length > 0 ? classStack[classStack.length - 1] : null; braceDepth = 0; }

      // Function declaration
      const funcMatch = line.match(funcRegex);
      if (funcMatch) {
        const fName = funcMatch[1];
        const parentId = currentClass ? currentClass.id : fileId;
        const fId = `${parentId}::${fName}_${i}`;
        funcNames.add(fName);
        entities.push({ id: fId, name: fName, type: 'function', file: filePath, line: i + 1, parentId, metadata: { params: funcMatch[2], isMethod: false, language: isTS ? 'typescript' : 'javascript' }, customDescription: vizDesc });
        relationships.push({ fromId: parentId, toId: fId, relation: 'contains' });
        continue;
      }

      // Arrow function (top-level const/let/var)
      const arrowMatch = line.match(arrowRegex);
      if (arrowMatch && !currentClass) {
        const aName = arrowMatch[1];
        const aId = `${fileId}::${aName}_${i}`;
        funcNames.add(aName);
        entities.push({ id: aId, name: aName, type: 'function', file: filePath, line: i + 1, parentId: fileId, metadata: { isArrow: true, language: isTS ? 'typescript' : 'javascript' }, customDescription: vizDesc });
        relationships.push({ fromId: fileId, toId: aId, relation: 'contains' });
        continue;
      }

      // Class method
      if (currentClass) {
        const mMatch = trimmed.match(methodRegex);
        if (mMatch) {
          const mName = mMatch[1];
          if (['if', 'for', 'while', 'switch', 'catch', 'return'].includes(mName)) { continue; }
          const mId = `${currentClass.id}::${mName}_${i}`;
          funcNames.add(mName);
          entities.push({ id: mId, name: mName, type: 'function', file: filePath, line: i + 1, parentId: currentClass.id, metadata: { params: mMatch[2], isMethod: true, className: currentClass.name, language: isTS ? 'typescript' : 'javascript', isConstructor: mName === 'constructor' }, customDescription: vizDesc });
          relationships.push({ fromId: currentClass.id, toId: mId, relation: 'contains' });
          continue;
        }
      }

      // Top-level variable
      if (!currentClass) {
        const vMatch = trimmed.match(varRegex);
        if (vMatch && !arrowMatch) {
          const vName = vMatch[1];
          if (['if', 'else', 'for', 'while', 'return'].includes(vName)) { continue; }
          // Check object instantiation
          const objMatch = vMatch[2].match(/new\s+(\w+)/);
          if (objMatch && classNames.has(objMatch[1])) {
            const objId = `${fileId}::obj_${vName}_${i}`;
            entities.push({ id: objId, name: vName, type: 'object', file: filePath, line: i + 1, parentId: fileId, metadata: { className: objMatch[1], language: isTS ? 'typescript' : 'javascript' }, customDescription: vizDesc });
            relationships.push({ fromId: fileId, toId: objId, relation: 'has' });
            relationships.push({ fromId: objId, toId: this.findClassId(objMatch[1], entities, fileId), relation: 'instantiates' });
          } else if (!vMatch[2].includes('=>')) {
            const varId = `${fileId}::var_${vName}_${i}`;
            entities.push({ id: varId, name: vName, type: 'variable', file: filePath, line: i + 1, parentId: fileId, metadata: { language: isTS ? 'typescript' : 'javascript' }, customDescription: vizDesc });
            relationships.push({ fromId: fileId, toId: varId, relation: 'has' });
          }
        }
      }

      // Call detection
      const callRx = /\b(\w+)\s*\(/g;
      let cm;
      while ((cm = callRx.exec(trimmed)) !== null) {
        const cn = cm[1];
        if (['if', 'for', 'while', 'switch', 'return', 'catch', 'new', 'require', 'import', 'console', 'setTimeout', 'setInterval', 'Promise', 'JSON', 'Object', 'Array', 'Math', 'Date', 'RegExp', 'Error', 'Map', 'Set', 'parseInt', 'parseFloat', 'isNaN', 'typeof', 'super'].includes(cn)) { continue; }
        if (funcNames.has(cn)) {
          const parentId = currentClass ? currentClass.id : fileId;
          const callers = entities.filter(e => e.type === 'function' && e.parentId === parentId);
          if (callers.length > 0) {
            const caller = callers[callers.length - 1];
            const targets = entities.filter(e => e.type === 'function' && e.name === cn);
            if (targets.length > 0 && caller.id !== targets[0].id) { relationships.push({ fromId: caller.id, toId: targets[0].id, relation: 'calls' }); }
          }
        }
      }
    }

    const seenRels = new Set<string>();
    const uniqueRels = relationships.filter(r => { const key = `${r.fromId}→${r.toId}→${r.relation}`; if (seenRels.has(key)) { return false; } seenRels.add(key); return true; });
    return { filePath, entities, relationships: uniqueRels, includes: imports };
  }

  private findClassId(className: string, entities: ParsedEntity[], fileId: string): string {
    const found = entities.find(e => e.type === 'class' && e.name === className);
    return found ? found.id : `${fileId}::${className}`;
  }
}

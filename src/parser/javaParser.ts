import * as fs from 'fs';
import * as path from 'path';
import { FileParseResult, ParsedEntity, ParsedRelationship } from '../models';

export class JavaParser {
  async parseFile(filePath: string): Promise<FileParseResult> {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const fileId = `file::${path.basename(filePath)}`;
    const entities: ParsedEntity[] = [];
    const relationships: ParsedRelationship[] = [];
    const imports: string[] = [];

    entities.push({ id: fileId, name: path.basename(filePath), type: 'file', file: filePath, line: 0, metadata: { path: filePath, language: 'java' } });

    const classRegex = /^\s*(?:(?:public|private|protected|abstract|final|static)\s+)*(?:class|interface|enum)\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{?/;
    const methodRegex = /^\s*(?:(?:public|private|protected|static|final|abstract|synchronized|native)\s+)*(?:<\w+>\s+)?(?:[\w<>\[\],\s]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*[{;]/;
    const fieldRegex = /^\s*(?:(?:public|private|protected|static|final|volatile|transient)\s+)*(?:[\w<>\[\]]+)\s+(\w+)\s*(?:=\s*[^;]+)?\s*;/;
    const importRegex = /^\s*import\s+(?:static\s+)?([^;]+);/;

    const classStack: Array<{ id: string; name: string }> = [];
    let braceDepth = 0;
    let currentClass: { id: string; name: string } | null = null;
    const classNames = new Set<string>();
    const methodNames = new Set<string>();

    for (const line of lines) { const cm = line.match(classRegex); if (cm) { classNames.add(cm[1]); } }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const vizMatch = line.match(/\/\/\s*@viz:\s*(.+)$/);
      const vizDesc = vizMatch ? vizMatch[1].trim() : undefined;

      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed === '') { continue; }

      const importMatch = trimmed.match(importRegex);
      if (importMatch) { imports.push(importMatch[1].trim()); continue; }
      if (trimmed.match(/^\s*package\s+/)) { continue; }

      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;

      const classMatch = line.match(classRegex);
      if (classMatch) {
        const className = classMatch[1];
        const baseClasses: string[] = [];
        if (classMatch[2]) { baseClasses.push(classMatch[2]); }
        if (classMatch[3]) { classMatch[3].split(',').map(s => s.trim()).filter(Boolean).forEach(s => baseClasses.push(s)); }

        let kind = 'class';
        if (line.includes('interface ')) { kind = 'interface'; }
        else if (line.includes('enum ')) { kind = 'enum'; }

        const classId = `${fileId}::${className}`;
        entities.push({ id: classId, name: className, type: 'class', file: filePath, line: i + 1, parentId: currentClass ? currentClass.id : fileId, metadata: { kind, baseClasses, language: 'java' }, customDescription: vizDesc });
        relationships.push({ fromId: currentClass ? currentClass.id : fileId, toId: classId, relation: 'contains' });
        for (const base of baseClasses) { relationships.push({ fromId: classId, toId: this.findClassId(base, entities, fileId), relation: 'inherits' }); }

        classStack.push({ id: classId, name: className });
        currentClass = classStack[classStack.length - 1];
        braceDepth += openBraces - closeBraces;
        continue;
      }

      braceDepth += openBraces - closeBraces;
      if (classStack.length > 0 && braceDepth <= 0) { classStack.pop(); currentClass = classStack.length > 0 ? classStack[classStack.length - 1] : null; braceDepth = 0; }

      const methodMatch = line.match(methodRegex);
      if (methodMatch && !classMatch) {
        const mName = methodMatch[1];
        if (['if', 'for', 'while', 'switch', 'catch', 'return', 'new'].includes(mName)) { continue; }
        const parentId = currentClass ? currentClass.id : fileId;
        const mId = `${parentId}::${mName}_${i}`;
        methodNames.add(mName);
        entities.push({ id: mId, name: mName, type: 'function', file: filePath, line: i + 1, parentId, metadata: { params: methodMatch[2], isMethod: !!currentClass, className: currentClass?.name, language: 'java', isConstructor: currentClass ? mName === currentClass.name : false }, customDescription: vizDesc });
        relationships.push({ fromId: parentId, toId: mId, relation: 'contains' });
        continue;
      }

      const fieldMatch = line.match(fieldRegex);
      if (fieldMatch && !methodMatch && !classMatch && currentClass) {
        const fName = fieldMatch[1];
        if (['if', 'else', 'for', 'while', 'return', 'new', 'throw', 'class'].includes(fName)) { continue; }
        const parentId = currentClass.id;
        const objMatch = trimmed.match(/(?:[\w<>\[\]]+)\s+(\w+)\s*=\s*new\s+(\w+)/);
        if (objMatch && classNames.has(objMatch[2])) {
          const objId = `${parentId}::obj_${objMatch[1]}_${i}`;
          entities.push({ id: objId, name: objMatch[1], type: 'object', file: filePath, line: i + 1, parentId, metadata: { className: objMatch[2], language: 'java' }, customDescription: vizDesc });
          relationships.push({ fromId: parentId, toId: objId, relation: 'has' });
          relationships.push({ fromId: objId, toId: this.findClassId(objMatch[2], entities, fileId), relation: 'instantiates' });
        } else {
          const varId = `${parentId}::var_${fName}_${i}`;
          entities.push({ id: varId, name: fName, type: 'variable', file: filePath, line: i + 1, parentId, metadata: { language: 'java' }, customDescription: vizDesc });
          relationships.push({ fromId: parentId, toId: varId, relation: 'has' });
        }
        continue;
      }

      // Function call detection
      const callRx = /\b(\w+)\s*\(/g;
      let cm;
      while ((cm = callRx.exec(trimmed)) !== null) {
        const cn = cm[1];
        if (['if', 'for', 'while', 'switch', 'return', 'catch', 'new', 'super', 'this', 'System', 'Math', 'String'].includes(cn)) { continue; }
        if (methodNames.has(cn) && currentClass) {
          const callers = entities.filter(e => e.type === 'function' && e.parentId === currentClass?.id);
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

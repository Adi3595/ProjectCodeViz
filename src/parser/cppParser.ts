import * as fs from 'fs';
import * as path from 'path';
import { FileParseResult, ParsedEntity, ParsedRelationship } from '../models';

// We use a regex-based parser as Tree-sitter native bindings
// require platform-specific compilation. The regex parser covers
// all required C++ constructs reliably for VS Code environments.

export class CppParser {
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
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const fileId = this.fileId(filePath);

    const entities: ParsedEntity[] = [];
    const relationships: ParsedRelationship[] = [];
    const includes: string[] = [];

    // File node itself
    entities.push({
      id: fileId,
      name: path.basename(filePath),
      type: 'file',
      file: filePath,
      line: 0,
      metadata: { path: filePath },
    });

    // Parse #include statements
    const includeRegex = /^\s*#include\s*[<"]([^>"]+)[>"]/;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(includeRegex);
      if (m) { includes.push(m[1]); }
    }

    // Parse classes, structs, enums
    const classRegex = /^\s*(?:template\s*<[^>]*>\s*)?(class|struct)\s+(\w+)(?:\s*:\s*((?:(?:public|protected|private)\s+\w+(?:\s*,\s*)?)+))?\s*\{?/;
    // Parse functions
    const funcRegex = /^\s*(?:(?:virtual|static|inline|explicit|constexpr|override|final)\s+)*(?:[\w:<>*&]+\s+)+(\w+)\s*\(([^)]*)\)\s*(?:const)?\s*(?:override|final)?\s*(?:=\s*0)?\s*[\{;]/;
    // Parse variables/members
    const varRegex = /^\s*(?:(?:static|const|mutable|volatile)\s+)*(?:[\w:<>*&]+(?:\s*\*|\s*&)?)\s+(\w+)\s*(?:=\s*[^;]+)?;/;
    // Object instantiation
    const objRegex = /^\s*(\w+)\s+(\w+)\s*(?:\([^)]*\))?\s*;/;

    const classStack: Array<{ id: string; name: string; startLine: number }> = [];
    let braceDepth = 0;
    let currentClass: { id: string; name: string; startLine: number } | null = null;

    const extractVizComment = (line: string): string | undefined => {
      const commentMatch = line.match(/\/\/\s*@viz:\s*(.+)$/);
      return commentMatch ? commentMatch[1].trim() : undefined;
    };

    const functionNames = new Set<string>();
    const classNames = new Set<string>();
    const variableIds = new Map<string, string>();

    // First pass: collect class names
    for (const line of lines) {
      const cm = line.match(classRegex);
      if (cm) { classNames.add(cm[2]); }
    }

    // Second pass: full parse
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const vizDesc = extractVizComment(line);

      // Count braces to track scope
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;

      // Class / Struct detection
      const classMatch = line.match(classRegex);
      if (classMatch) {
        const classKind = classMatch[1];
        const className = classMatch[2];
        const baseClassesStr = classMatch[3] || '';
        const baseClasses = baseClassesStr
          .split(',')
          .map(b => b.replace(/public|protected|private/g, '').trim())
          .filter(Boolean);

        const classId = `${fileId}::${className}`;
        const entity: ParsedEntity = {
          id: classId,
          name: className,
          type: 'class',
          file: filePath,
          line: i + 1,
          parentId: fileId,
          metadata: {
            kind: classKind,
            baseClasses,
          },
          customDescription: vizDesc,
        };
        entities.push(entity);
        classNames.add(className);

        // file → class (contains)
        relationships.push({ fromId: fileId, toId: classId, relation: 'contains' });

        // inheritance
        for (const base of baseClasses) {
          if (base) {
            const baseId = this.findClassId(base, entities, fileId);
            relationships.push({ fromId: classId, toId: baseId, relation: 'inherits' });
          }
        }

        classStack.push({ id: classId, name: className, startLine: i });
        currentClass = { id: classId, name: className, startLine: i };
      }

      // Update brace depth
      braceDepth += openBraces - closeBraces;
      if (classStack.length > 0 && braceDepth <= 0) {
        classStack.pop();
        currentClass = classStack.length > 0 ? classStack[classStack.length - 1] : null;
        braceDepth = 0;
      }

      // Function detection
      const funcMatch = line.match(funcRegex);
      if (funcMatch && !classMatch) {
        const funcName = funcMatch[1];
        // Skip common false positives
        if (['if', 'for', 'while', 'switch', 'catch', 'return'].includes(funcName)) { continue; }
        if (funcName === funcName.toUpperCase() && funcName.length > 2) { continue; } // macros

        const parentId = currentClass ? currentClass.id : fileId;
        const funcId = `${parentId}::${funcName}_${i}`;
        functionNames.add(funcName);

        const entity: ParsedEntity = {
          id: funcId,
          name: funcName,
          type: 'function',
          file: filePath,
          line: i + 1,
          parentId,
          metadata: {
            params: funcMatch[2],
            isMethod: !!currentClass,
            className: currentClass?.name,
          },
          customDescription: vizDesc,
        };
        entities.push(entity);

        // parent → function
        const relation = currentClass ? 'contains' : 'contains';
        relationships.push({ fromId: parentId, toId: funcId, relation });
      }

      // Variable declaration detection
      const varMatch = line.match(varRegex);
      if (varMatch && !funcMatch && !classMatch) {
        const varName = varMatch[1];
        if (['return', 'delete', 'new', 'if', 'else', 'for', 'while'].includes(varName)) { continue; }

        const parentId = currentClass ? currentClass.id : fileId;
        const varId = `${parentId}::var_${varName}_${i}`;

        // Check if this is an object instantiation (type is a known class)
        const objInstMatch = line.match(/^\s*(\w+)\s+(\w+)\s*(?:\([^)]*\))?\s*;/);
        if (objInstMatch && classNames.has(objInstMatch[1]) && objInstMatch[1] !== objInstMatch[2]) {
          const objId = `${parentId}::obj_${objInstMatch[2]}_${i}`;
          const entity: ParsedEntity = {
            id: objId,
            name: objInstMatch[2],
            type: 'object',
            file: filePath,
            line: i + 1,
            parentId,
            metadata: {
              className: objInstMatch[1],
            },
            customDescription: vizDesc,
          };
          entities.push(entity);
          relationships.push({ fromId: parentId, toId: objId, relation: 'has' });

          // object → class (instantiates)
          const targetClassId = this.findClassId(objInstMatch[1], entities, fileId);
          relationships.push({ fromId: objId, toId: targetClassId, relation: 'instantiates' });
        } else {
          const entity: ParsedEntity = {
            id: varId,
            name: varName,
            type: 'variable',
            file: filePath,
            line: i + 1,
            parentId,
            metadata: {},
            customDescription: vizDesc,
          };
          entities.push(entity);
          variableIds.set(varName, varId);
          relationships.push({ fromId: parentId, toId: varId, relation: 'has' });
        }
      }

      // Function call detection (within function body)
      const callRegex = /\b(\w+)\s*\(/g;
      let callMatch;
      while ((callMatch = callRegex.exec(line)) !== null) {
        const calledName = callMatch[1];
        if (['if', 'for', 'while', 'switch', 'return', 'catch', 'sizeof', 'static_cast', 'dynamic_cast', 'reinterpret_cast', 'const_cast'].includes(calledName)) { continue; }
        if (functionNames.has(calledName) && currentClass) {
          const callerFuncs = entities.filter(
            e => e.type === 'function' && e.parentId === (currentClass?.id || fileId)
          );
          if (callerFuncs.length > 0) {
            const caller = callerFuncs[callerFuncs.length - 1];
            const targetFuncs = entities.filter(e => e.type === 'function' && e.name === calledName);
            if (targetFuncs.length > 0 && caller.id !== targetFuncs[0].id) {
              relationships.push({ fromId: caller.id, toId: targetFuncs[0].id, relation: 'calls' });
            }
          }
        }
      }
    }

    // Deduplicate relationships
    const seenRels = new Set<string>();
    const uniqueRels = relationships.filter(r => {
      const key = `${r.fromId}→${r.toId}→${r.relation}`;
      if (seenRels.has(key)) { return false; }
      seenRels.add(key);
      return true;
    });

    return { filePath, entities, relationships: uniqueRels, includes };
  }

  private fileId(filePath: string): string {
    return `file::${path.basename(filePath)}`;
  }

  private findClassId(className: string, entities: ParsedEntity[], fileId: string): string {
    const found = entities.find(e => e.type === 'class' && e.name === className);
    return found ? found.id : `${fileId}::${className}`;
  }
}

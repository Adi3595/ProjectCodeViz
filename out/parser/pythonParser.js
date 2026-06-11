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
exports.PythonParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Regex-based Python parser.
 * Detects classes, functions, methods, variables, imports, decorators,
 * and relationships between them.
 */
class PythonParser {
    async parseFile(filePath) {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        const fileId = `file::${path.basename(filePath)}`;
        const entities = [];
        const relationships = [];
        const imports = [];
        // File node
        entities.push({
            id: fileId,
            name: path.basename(filePath),
            type: 'file',
            file: filePath,
            line: 0,
            metadata: { path: filePath, language: 'python' },
        });
        // Regex patterns
        const classRegex = /^(\s*)class\s+(\w+)(?:\(([^)]*)\))?\s*:/;
        const funcRegex = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*\S+)?\s*:/;
        const importRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)/;
        const varRegex = /^(\w+)\s*(?::\s*\w+)?\s*=\s*.+/;
        const decoratorRegex = /^(\s*)@(\w+)/;
        const classStack = [];
        const functionNames = new Set();
        const classNames = new Set();
        // First pass: collect class names
        for (const line of lines) {
            const cm = line.match(classRegex);
            if (cm) {
                classNames.add(cm[2]);
            }
        }
        let lastDecorator;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trimStart();
            const indent = line.length - trimmed.length;
            const vizMatch = line.match(/\s*#\s*@viz:\s*(.+)$/);
            const vizDesc = vizMatch ? vizMatch[1].trim() : undefined;
            // Pop class stack based on indentation
            while (classStack.length > 0 && indent <= classStack[classStack.length - 1].indent) {
                classStack.pop();
            }
            const currentClass = classStack.length > 0 ? classStack[classStack.length - 1] : null;
            // Decorator
            const decoMatch = line.match(decoratorRegex);
            if (decoMatch) {
                lastDecorator = decoMatch[2];
                continue;
            }
            // Import
            const importMatch = trimmed.match(importRegex);
            if (importMatch && indent === 0) {
                const mod = importMatch[1] || importMatch[2];
                imports.push(mod.split(',')[0].trim());
                lastDecorator = undefined;
                continue;
            }
            // Class
            const classMatch = line.match(classRegex);
            if (classMatch) {
                const className = classMatch[2];
                const baseClassesStr = classMatch[3] || '';
                const baseClasses = baseClassesStr
                    .split(',')
                    .map(b => b.trim())
                    .filter(b => b && b !== 'object');
                const classId = `${fileId}::${className}`;
                entities.push({
                    id: classId,
                    name: className,
                    type: 'class',
                    file: filePath,
                    line: i + 1,
                    parentId: currentClass ? currentClass.id : fileId,
                    metadata: {
                        kind: 'class',
                        baseClasses,
                        language: 'python',
                        decorator: lastDecorator,
                    },
                    customDescription: vizDesc,
                });
                relationships.push({
                    fromId: currentClass ? currentClass.id : fileId,
                    toId: classId,
                    relation: 'contains',
                });
                for (const base of baseClasses) {
                    const baseId = this.findClassId(base, entities, fileId);
                    relationships.push({ fromId: classId, toId: baseId, relation: 'inherits' });
                }
                classStack.push({ id: classId, name: className, indent });
                classNames.add(className);
                lastDecorator = undefined;
                continue;
            }
            // Function / Method
            const funcMatch = line.match(funcRegex);
            if (funcMatch) {
                const funcName = funcMatch[2];
                if (['__init__', '__del__', '__repr__', '__str__'].includes(funcName)) {
                    // Still add as function but mark as special
                }
                const parentId = currentClass ? currentClass.id : fileId;
                const funcId = `${parentId}::${funcName}_${i}`;
                functionNames.add(funcName);
                const params = funcMatch[3]
                    .split(',')
                    .map(p => p.trim())
                    .filter(p => p && p !== 'self' && p !== 'cls');
                entities.push({
                    id: funcId,
                    name: funcName,
                    type: 'function',
                    file: filePath,
                    line: i + 1,
                    parentId,
                    metadata: {
                        params: params.join(', '),
                        isMethod: !!currentClass,
                        className: currentClass?.name,
                        language: 'python',
                        isConstructor: funcName === '__init__',
                        isDestructor: funcName === '__del__',
                        decorator: lastDecorator,
                    },
                    customDescription: vizDesc,
                });
                relationships.push({ fromId: parentId, toId: funcId, relation: 'contains' });
                lastDecorator = undefined;
                continue;
            }
            // Module-level variable
            if (indent === 0) {
                const varMatch2 = trimmed.match(varRegex);
                if (varMatch2 && !trimmed.startsWith('#') && !trimmed.startsWith('import') && !trimmed.startsWith('from')) {
                    const varName = varMatch2[1];
                    if (['if', 'else', 'elif', 'for', 'while', 'return', 'yield', 'raise', 'try', 'except', 'finally', 'with', 'assert', 'pass', 'break', 'continue', 'del', 'print'].includes(varName)) {
                        continue;
                    }
                    const varId = `${fileId}::var_${varName}_${i}`;
                    // Check if it's an object instantiation
                    const objMatch = trimmed.match(/^(\w+)\s*=\s*(\w+)\s*\(/);
                    if (objMatch && classNames.has(objMatch[2])) {
                        const objId = `${fileId}::obj_${objMatch[1]}_${i}`;
                        entities.push({
                            id: objId,
                            name: objMatch[1],
                            type: 'object',
                            file: filePath,
                            line: i + 1,
                            parentId: fileId,
                            metadata: { className: objMatch[2], language: 'python' },
                            customDescription: vizDesc,
                        });
                        relationships.push({ fromId: fileId, toId: objId, relation: 'has' });
                        const targetClassId = this.findClassId(objMatch[2], entities, fileId);
                        relationships.push({ fromId: objId, toId: targetClassId, relation: 'instantiates' });
                    }
                    else {
                        entities.push({
                            id: varId,
                            name: varName,
                            type: 'variable',
                            file: filePath,
                            line: i + 1,
                            parentId: fileId,
                            metadata: { language: 'python' },
                            customDescription: vizDesc,
                        });
                        relationships.push({ fromId: fileId, toId: varId, relation: 'has' });
                    }
                }
            }
            lastDecorator = undefined;
            // Function call detection
            const callRegex = /\b(\w+)\s*\(/g;
            let callMatch;
            while ((callMatch = callRegex.exec(trimmed)) !== null) {
                const calledName = callMatch[1];
                if (['if', 'for', 'while', 'print', 'return', 'range', 'len', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'type', 'isinstance', 'issubclass', 'super', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed', 'any', 'all', 'min', 'max', 'abs', 'sum', 'open', 'input', 'hasattr', 'getattr', 'setattr', 'delattr', 'property', 'staticmethod', 'classmethod'].includes(calledName)) {
                    continue;
                }
                if (functionNames.has(calledName) && currentClass) {
                    const callerFuncs = entities.filter(e => e.type === 'function' && e.parentId === (currentClass?.id || fileId));
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
        const seenRels = new Set();
        const uniqueRels = relationships.filter(r => {
            const key = `${r.fromId}→${r.toId}→${r.relation}`;
            if (seenRels.has(key)) {
                return false;
            }
            seenRels.add(key);
            return true;
        });
        return { filePath, entities, relationships: uniqueRels, includes: imports };
    }
    findClassId(className, entities, fileId) {
        const found = entities.find(e => e.type === 'class' && e.name === className);
        return found ? found.id : `${fileId}::${className}`;
    }
}
exports.PythonParser = PythonParser;

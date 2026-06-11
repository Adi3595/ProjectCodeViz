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
exports.RelationshipAnalyzer = void 0;
const path = __importStar(require("path"));
class RelationshipAnalyzer {
    analyze(fileResults, errorMap) {
        const entityMap = new Map();
        // Register all entities
        for (const result of fileResults) {
            for (const entity of result.entities) {
                entityMap.set(entity.id, entity);
            }
        }
        // Collect all relationships
        const allRelationships = [];
        for (const result of fileResults) {
            allRelationships.push(...result.relationships);
        }
        // Cross-file include relationships
        for (const result of fileResults) {
            const srcFileId = `file::${path.basename(result.filePath)}`;
            for (const include of result.includes) {
                const includeName = path.basename(include);
                // Find the file node matching the include
                const targetFile = fileResults.find(r => path.basename(r.filePath).toLowerCase() === includeName.toLowerCase() ||
                    path.basename(r.filePath).toLowerCase() === includeName.toLowerCase() + '.h' ||
                    path.basename(r.filePath).toLowerCase() === includeName.toLowerCase() + '.hpp');
                if (targetFile) {
                    const targetFileId = `file::${path.basename(targetFile.filePath)}`;
                    if (srcFileId !== targetFileId) {
                        allRelationships.push({
                            fromId: srcFileId,
                            toId: targetFileId,
                            relation: 'includes',
                        });
                    }
                }
            }
        }
        // Deduplicate
        const seenRels = new Set();
        const uniqueRels = allRelationships.filter(r => {
            const key = `${r.fromId}→${r.toId}→${r.relation}`;
            if (seenRels.has(key)) {
                return false;
            }
            seenRels.add(key);
            return true;
        });
        return {
            entities: entityMap,
            relationships: uniqueRels,
            fileResults,
            errorMap,
        };
    }
}
exports.RelationshipAnalyzer = RelationshipAnalyzer;

import * as path from 'path';
import {
  FileParseResult,
  ParsedEntity,
  ParsedRelationship,
  AnalysisResult,
  ClangError,
} from '../models';

export class RelationshipAnalyzer {
  analyze(
    fileResults: FileParseResult[],
    errorMap: Map<string, ClangError[]>
  ): AnalysisResult {
    const entityMap = new Map<string, ParsedEntity>();

    // Register all entities
    for (const result of fileResults) {
      for (const entity of result.entities) {
        entityMap.set(entity.id, entity);
      }
    }

    // Collect all relationships
    const allRelationships: ParsedRelationship[] = [];
    for (const result of fileResults) {
      allRelationships.push(...result.relationships);
    }

    // Cross-file include relationships
    for (const result of fileResults) {
      const srcFileId = `file::${path.basename(result.filePath)}`;
      for (const include of result.includes) {
        const includeName = path.basename(include);
        // Find the file node matching the include
        const targetFile = fileResults.find(r =>
          path.basename(r.filePath).toLowerCase() === includeName.toLowerCase() ||
          path.basename(r.filePath).toLowerCase() === includeName.toLowerCase() + '.h' ||
          path.basename(r.filePath).toLowerCase() === includeName.toLowerCase() + '.hpp'
        );
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
    const seenRels = new Set<string>();
    const uniqueRels = allRelationships.filter(r => {
      const key = `${r.fromId}→${r.toId}→${r.relation}`;
      if (seenRels.has(key)) { return false; }
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

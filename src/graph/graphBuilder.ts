import * as path from 'path';
import {
  AnalysisResult,
  NodeModel,
  EdgeModel,
  GraphData,
  ParsedEntity,
  ClangError,
} from '../models';

export class GraphBuilder {
  build(analysis: AnalysisResult): GraphData {
    const nodes: NodeModel[] = [];
    const edges: EdgeModel[] = [];

    // Build node map for quick lookup
    const nodeMap = new Map<string, NodeModel>();

    // Convert entities to nodes
    for (const [id, entity] of analysis.entities) {
      const errors = this.getEntityErrors(entity, analysis.errorMap);
      const node: NodeModel = {
        id: entity.id,
        label: entity.name,
        type: entity.type,
        file: entity.file,
        line: entity.line,
        metadata: {
          ...entity.metadata,
          customDescription: entity.customDescription,
        },
        error: errors.length > 0 ? errors.map(e => `${e.severity.toUpperCase()}: Line ${e.line}:${e.column} — ${e.message}`).join('\n') : undefined,
      };
      nodes.push(node);
      nodeMap.set(id, node);
    }

    // Convert relationships to edges
    for (const rel of analysis.relationships) {
      const fromNode = nodeMap.get(rel.fromId);
      const toNode = nodeMap.get(rel.toId);

      // Create ghost nodes for referenced but not parsed entities
      let from = fromNode;
      let to = toNode;

      if (!from) {
        const ghostNode: NodeModel = {
          id: rel.fromId,
          label: rel.fromId.split('::').pop() || rel.fromId,
          type: 'class',
          file: 'external',
          metadata: { isExternal: true },
        };
        nodes.push(ghostNode);
        nodeMap.set(rel.fromId, ghostNode);
        from = ghostNode;
      }

      if (!to) {
        const ghostNode: NodeModel = {
          id: rel.toId,
          label: rel.toId.split('::').pop() || rel.toId,
          type: 'class',
          file: 'external',
          metadata: { isExternal: true },
        };
        nodes.push(ghostNode);
        nodeMap.set(rel.toId, ghostNode);
        to = ghostNode;
      }

      const description = this.buildDescription(from, to, rel.relation);
      const hasError = !!(from.error || to.error);

      edges.push({
        from: rel.fromId,
        to: rel.toId,
        relation: rel.relation,
        description,
        error: hasError ? 'One or more connected nodes have errors' : undefined,
      });
    }

    // Deduplicate nodes
    const seenNodeIds = new Set<string>();
    const uniqueNodes = nodes.filter(n => {
      if (seenNodeIds.has(n.id)) { return false; }
      seenNodeIds.add(n.id);
      return true;
    });

    // Deduplicate edges
    const seenEdgeKeys = new Set<string>();
    const uniqueEdges = edges.filter(e => {
      const key = `${e.from}→${e.to}→${e.relation}`;
      if (seenEdgeKeys.has(key)) { return false; }
      seenEdgeKeys.add(key);
      return true;
    });

    return {
      nodes: uniqueNodes,
      edges: uniqueEdges,
      meta: {
        rootPath: '',
        fileCount: analysis.fileResults.length,
        parsedAt: new Date().toISOString(),
      },
    };
  }

  private buildDescription(from: NodeModel, to: NodeModel, relation: string): string {
    const fromDesc = from.metadata?.customDescription;
    const toDesc = to.metadata?.customDescription;

    if (fromDesc && toDesc) {
      return `${fromDesc} ${this.relationVerb(relation)} ${toDesc}`;
    } else if (fromDesc) {
      return `${fromDesc} ${this.relationVerb(relation)} ${to.label}`;
    } else if (toDesc) {
      return `${from.label} ${this.relationVerb(relation)} ${toDesc}`;
    } else {
      return this.autoDescription(from, to, relation);
    }
  }

  private relationVerb(relation: string): string {
    const verbs: Record<string, string> = {
      contains: 'contains',
      has: 'has member',
      calls: 'calls',
      uses: 'uses',
      inherits: 'inherits from',
      instantiates: 'creates instance of',
      includes: 'includes',
      depends_on: 'depends on',
    };
    return verbs[relation] || relation;
  }

  private autoDescription(from: NodeModel, to: NodeModel, relation: string): string {
    const typeLabel = (type: string) => {
      const labels: Record<string, string> = {
        class: 'class',
        function: 'function',
        variable: 'variable',
        object: 'object',
        file: 'file',
      };
      return labels[type] || type;
    };

    switch (relation) {
      case 'contains':
        return `${typeLabel(from.type)} "${from.label}" contains ${typeLabel(to.type)} "${to.label}"`;
      case 'has':
        return `${typeLabel(from.type)} "${from.label}" has member "${to.label}"`;
      case 'calls':
        return `"${from.label}" calls "${to.label}"`;
      case 'uses':
        return `"${from.label}" uses variable "${to.label}"`;
      case 'inherits':
        return `"${from.label}" inherits from "${to.label}"`;
      case 'instantiates':
        return `"${from.label}" is an instance of class "${to.label}"`;
      case 'includes':
        return `file "${from.label}" includes "${to.label}"`;
      default:
        return `"${from.label}" ${relation} "${to.label}"`;
    }
  }

  private getEntityErrors(entity: ParsedEntity, errorMap: Map<string, ClangError[]>): ClangError[] {
    const fileErrors = errorMap.get(entity.file) || [];
    if (!entity.line) {
      // For file-level nodes, return all errors/warnings for the file
      return fileErrors;
    }
    const endLine = entity.endLine || entity.line + 20;
    return fileErrors.filter(
      e => (e.severity === 'error' || e.severity === 'warning') && e.line >= entity.line && e.line <= endLine
    );
  }
}

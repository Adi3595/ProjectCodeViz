// ============================================================
// Shared Models for ProjectCodeWiz
// ============================================================

export interface NodeModel {
  id: string;
  label: string;
  type: 'class' | 'function' | 'variable' | 'object' | 'file';
  file: string;
  line?: number;
  metadata: {
    customDescription?: string;
    returnType?: string;
    parameters?: string[];
    visibility?: string;
    baseClasses?: string[];
    isConstructor?: boolean;
    isDestructor?: boolean;
    [key: string]: any;
  };
  error?: string;
}

export interface EdgeModel {
  from: string;
  to: string;
  relation:
    | 'contains'
    | 'has'
    | 'calls'
    | 'uses'
    | 'inherits'
    | 'instantiates'
    | 'includes'
    | 'depends_on';
  description: string;
  error?: string;
}

export interface GraphData {
  nodes: NodeModel[];
  edges: EdgeModel[];
  meta: {
    rootPath: string;
    fileCount: number;
    parsedAt: string;
  };
}

export interface ParsedEntity {
  id: string;
  name: string;
  type: 'class' | 'function' | 'variable' | 'object' | 'file';
  file: string;
  line: number;
  endLine?: number;
  parentId?: string;
  metadata: Record<string, any>;
  customDescription?: string;
}

export interface ParsedRelationship {
  fromId: string;
  toId: string;
  relation: EdgeModel['relation'];
}

export interface FileParseResult {
  filePath: string;
  entities: ParsedEntity[];
  relationships: ParsedRelationship[];
  includes: string[];
}

export interface AnalysisResult {
  entities: Map<string, ParsedEntity>;
  relationships: ParsedRelationship[];
  fileResults: FileParseResult[];
  errorMap: Map<string, ClangError[]>;
}

export interface ClangError {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'note';
  message: string;
}

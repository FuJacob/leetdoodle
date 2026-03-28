let nextId = 1;

export type NodeType = 'note' | 'problem';

export interface Transform {
  x: number;
  y: number;
  zoom: number;
}

// ---------------------------------------------------------------------------
// Abstract base
// ---------------------------------------------------------------------------

export abstract class CanvasNode {
  abstract readonly type: NodeType;
  abstract data: Record<string, unknown>;

  constructor(
    public id: string,
    public x: number,
    public y: number,
    public readonly width: number,
    public readonly height: number,
  ) {}
}

// ---------------------------------------------------------------------------
// NoteNode
// ---------------------------------------------------------------------------

export interface NoteData extends Record<string, unknown> {
  content: string;
}

export class NoteNode extends CanvasNode {
  readonly type = 'note' as const;
  data: NoteData;

  constructor(id: string, x: number, y: number, data?: Partial<NoteData>) {
    super(id, x, y, 220, 120);
    this.data = { content: '', ...data };
  }

  static create(x: number, y: number): NoteNode {
    return new NoteNode(String(nextId++), x, y);
  }
}

// ---------------------------------------------------------------------------
// ProblemNode
// ---------------------------------------------------------------------------

export interface ProblemData extends Record<string, unknown> {
  title: string;
  description: string;
}

export class ProblemNode extends CanvasNode {
  readonly type = 'problem' as const;
  data: ProblemData;

  constructor(id: string, x: number, y: number, data?: Partial<ProblemData>) {
    super(id, x, y, 280, 160);
    this.data = { title: 'Untitled Problem', description: '', ...data };
  }

  static create(x: number, y: number): ProblemNode {
    return new ProblemNode(String(nextId++), x, y);
  }
}

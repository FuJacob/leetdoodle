let nextId = 1;

// ---------------------------------------------------------------------------
// Base fields shared by every node type
// ---------------------------------------------------------------------------

interface CanvasNodeBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Note node
// ---------------------------------------------------------------------------

export interface NoteNode extends CanvasNodeBase {
  type: 'note';
  data: { content: string };
}

// ---------------------------------------------------------------------------
// Problem node
// ---------------------------------------------------------------------------

export interface ProblemTag {
  id: number;
  name: string;
}

export interface ProblemStats {
  totalAccepted: string;
  totalSubmission: string;
  acRate: string;
}

// Discriminated union on `status` — TypeScript narrows this automatically
// in switch/if statements, so no casts are needed in the renderer.
export type ProblemData =
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | {
      status: 'loaded';
      slug: string;
      title: string;
      difficulty: string;
      content: string;
      tags: ProblemTag[];
      likes: number;
      dislikes: number;
      stats: string | null; // raw JSON string from the API
    };

export interface ProblemNode extends CanvasNodeBase {
  type: 'problem';
  data: ProblemData;
}

// ---------------------------------------------------------------------------
// Union + helpers
// ---------------------------------------------------------------------------

export type CanvasNode = NoteNode | ProblemNode;
export type NodeType = CanvasNode['type'];

export function createNoteNode(x: number, y: number): NoteNode {
  return {
    id: String(nextId++),
    type: 'note',
    x,
    y,
    width: 220,
    height: 120,
    data: { content: '' },
  };
}

export function createProblemNode(x: number, y: number): ProblemNode {
  return {
    id: String(nextId++),
    type: 'problem',
    x,
    y,
    width: 320,
    height: 120,
    data: { status: 'empty' },
  };
}

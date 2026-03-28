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
// Node types
// ---------------------------------------------------------------------------

export interface NoteNode extends CanvasNodeBase {
  type: 'note';
  data: { content: string };
}

export interface ProblemNode extends CanvasNodeBase {
  type: 'problem';
  data: { title: string; description: string };
}

// Discriminated union — TypeScript narrows this automatically in switch/if
export type CanvasNode = NoteNode | ProblemNode;

// Derived from the union so it never gets out of sync
export type NodeType = CanvasNode['type'];

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

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
    width: 280,
    height: 160,
    data: { title: 'Untitled Problem', description: '' },
  };
}

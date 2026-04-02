let nextId = 1;
const DEFAULT_CODE_LINE_COUNT = 16;
const DEFAULT_CODE_CONTENT = "\n".repeat(DEFAULT_CODE_LINE_COUNT - 1);

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
      questionId: number;
      title: string;
      difficulty: string;
      content: string;
      tags: ProblemTag[];
      likes: number;
      dislikes: number;
      stats: string | null; // raw JSON string from the API
      starterCode: string | null;
    };

export interface ProblemNode extends CanvasNodeBase {
  type: 'problem';
  data: ProblemData;
}

// ---------------------------------------------------------------------------
// Code node
// ---------------------------------------------------------------------------

export interface CodeNode extends CanvasNodeBase {
  type: 'code';
  data: {
    content: string;
    language: string;
  };
}

// ---------------------------------------------------------------------------
// Test results node (RUN-only for now)
// ---------------------------------------------------------------------------

export interface TestResultsCase {
  input: string;
  output: string | null;
  expected: string | null;
  passed: boolean;
  error?: string | null;
}

export type TestResultsMode = 'testcase' | 'result';

export type TestResultsRunState =
  | 'idle'
  | 'running'
  | 'accepted'
  | 'wrong_answer'
  | 'runtime_error'
  | 'time_limit_exceeded';

export interface TestResultsData {
  mode: TestResultsMode;
  runState: TestResultsRunState;
  runtimeMs: number | null;
  selectedCaseIndex: number;
  cases: TestResultsCase[];
  // Used by runtime-error view.
  errorMessage?: string;
  lastExecutedInput?: string;
}

export interface TestResultsNode extends CanvasNodeBase {
  type: 'test-results';
  data: TestResultsData;
}

// ---------------------------------------------------------------------------
// Draw node
// ---------------------------------------------------------------------------

export interface DrawNode extends CanvasNodeBase {
  type: 'draw';
  data: {
    // Points in node-local coordinates (offset from node.x, node.y in world space)
    points: Array<[number, number]>;
    thickness: number;
  };
}

// ---------------------------------------------------------------------------
// Union + helpers
// ---------------------------------------------------------------------------

export type CanvasNode = NoteNode | ProblemNode | CodeNode | TestResultsNode | DrawNode;
export type NodeType = CanvasNode['type'];

export interface Edge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export function createNoteNode(x: number, y: number): NoteNode {
  return {
    id: String(nextId++),
    type: 'note',
    x,
    y,
    width: 280,
    height: 180,
    data: { content: '' },
  };
}

export function createProblemNode(x: number, y: number): ProblemNode {
  return {
    id: String(nextId++),
    type: 'problem',
    x,
    y,
    width: 460,
    height: 180,
    data: { status: 'empty' },
  };
}

export function createCodeNode(x: number, y: number): CodeNode {
  return {
    id: String(nextId++),
    type: 'code',
    x,
    y,
    width: 560,
    height: 320,
    data: { content: DEFAULT_CODE_CONTENT, language: 'python' },
  };
}

export function createDrawNode(
  x: number,
  y: number,
  width: number,
  height: number,
  points: Array<[number, number]>,
  thickness: number,
): DrawNode {
  return {
    id: crypto.randomUUID(),
    type: 'draw',
    x,
    y,
    width,
    height,
    data: { points, thickness },
  };
}

export function createTestResultsNode(x: number, y: number): TestResultsNode {
  return {
    id: String(nextId++),
    type: 'test-results',
    x,
    y,
    width: 540,
    height: 420,
    data: {
      mode: 'testcase',
      runState: 'idle',
      runtimeMs: null,
      selectedCaseIndex: 0,
      cases: [],
    },
  };
}

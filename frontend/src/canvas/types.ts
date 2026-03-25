// frontend/src/canvas/types.ts

export interface Transform {
  x: number;    // panX — world origin offset in screen pixels
  y: number;    // panY — world origin offset in screen pixels
  zoom: number; // scale factor (1 = 100%)
}

export type NodeType = 'note'; // extend later: 'code' | 'problem'

export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;    // world-space position
  y: number;
  width: number;
  height: number;
  data: Record<string, unknown>;
}

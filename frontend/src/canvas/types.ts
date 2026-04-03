// Transform is the only type still needed standalone — node types live in nodes.ts
export interface Transform {
  x: number; // panX — world origin offset in screen pixels
  y: number; // panY — world origin offset in screen pixels
  zoom: number; // scale factor (1 = 100%)
}

export type LocalCursorMode =
  | "pointer"
  | "resize-nwse"
  | "resize-nesw"
  | "grab"
  | "grabbing";

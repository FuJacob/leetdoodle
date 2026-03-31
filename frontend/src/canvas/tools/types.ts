import type { CanvasNode } from "../../shared/nodes";

export type CanvasTool = "select" | "draw";

export interface CanvasToolController {
  onCanvasPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onCanvasPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onNodePointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    node: CanvasNode,
  ) => void;
  layers: React.ReactNode;
}

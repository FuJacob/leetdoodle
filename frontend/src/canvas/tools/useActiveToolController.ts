import type { CanvasTool, CanvasToolController } from "./types";

export function useActiveToolController(
  tool: CanvasTool,
  selectController: CanvasToolController,
  drawController: CanvasToolController,
): CanvasToolController {
  return tool === "draw" ? drawController : selectController;
}

import type { CanvasTool, CanvasToolController } from "./types";

/**
 * Chooses the currently active tool controller for the canvas surface.
 *
 * Canvas calls this once after constructing each tool controller so the view
 * can bind a single set of pointer handlers regardless of the active tool.
 */
export function useActiveToolController(
  tool: CanvasTool,
  selectController: CanvasToolController,
  drawController: CanvasToolController,
): CanvasToolController {
  return tool === "draw" ? drawController : selectController;
}

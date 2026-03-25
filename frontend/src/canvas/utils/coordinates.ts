import type { Transform } from '../types';

/**
 * Convert a screen-space point to world-space.
 * screenX/Y must be relative to the viewport's top-left corner.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  transform: Transform,
): { x: number; y: number } {
  return {
    x: (screenX - transform.x) / transform.zoom,
    y: (screenY - transform.y) / transform.zoom,
  };
}

/**
 * Convert a world-space point to screen-space.
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  transform: Transform,
): { x: number; y: number } {
  return {
    x: worldX * transform.zoom + transform.x,
    y: worldY * transform.zoom + transform.y,
  };
}

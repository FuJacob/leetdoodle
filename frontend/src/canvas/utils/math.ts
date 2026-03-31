import type { Transform } from "../types";

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 5;
export const ZOOM_SENSITIVITY = 0.02;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Compute a new transform after zooming toward a screen-space point.
 * Keeps the world point under the cursor fixed during zoom.
 *
 * delta: WheelEvent.deltaY — positive = scroll down = zoom out, negative = zoom in.
 */
export function zoomToward(
  transform: Transform,
  screenX: number,
  screenY: number,
  delta: number,
): Transform {
  // Exponential scaling keeps zoom factor positive and consistent across devices.
  const factor = Math.exp(-delta * ZOOM_SENSITIVITY);
  const newZoom = clamp(transform.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const ratio = newZoom / transform.zoom;

  return {
    zoom: newZoom,
    x: screenX - (screenX - transform.x) * ratio,
    y: screenY - (screenY - transform.y) * ratio,
  };
}

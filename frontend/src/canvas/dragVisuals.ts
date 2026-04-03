import type { CSSProperties } from "react";

export interface NodeDragVisual {
  dx: number;
  dy: number;
  color: string;
  isLocal: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(color: string): [number, number, number] | null {
  const normalized = color.trim();
  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;

  if (hex.length === 3) {
    const [r, g, b] = hex.split("");
    return [
      Number.parseInt(r + r, 16),
      Number.parseInt(g + g, 16),
      Number.parseInt(b + b, 16),
    ];
  }

  if (hex.length === 6) {
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ];
  }

  return null;
}

function colorWithAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return `rgba(59, 130, 246, ${alpha})`;
  }
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function getNodeDragStyle(
  dragVisual?: NodeDragVisual,
): CSSProperties {
  const baseStyle: CSSProperties = {
    transformOrigin: "50% 45%",
    transition:
      "transform 120ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 120ms ease, filter 120ms ease",
    willChange: "transform, box-shadow, filter",
  };

  if (!dragVisual) {
    return baseStyle;
  }

  const magnitude = Math.hypot(dragVisual.dx, dragVisual.dy);
  const liftPx = clamp(7 + magnitude * 3.5, 7, 13);
  const rotateDeg = clamp(dragVisual.dx * 20, -5, 5);
  const tiltDeg = clamp(-dragVisual.dy * 14, -3, 3);
  const scale = 1.012 + Math.min(magnitude * 0.01, 0.018);
  const accentGlow = colorWithAlpha(
    dragVisual.color,
    dragVisual.isLocal ? 0.16 : 0.24,
  );

  return {
    ...baseStyle,
    transform: `translate3d(0, ${-liftPx}px, 0) rotate(${rotateDeg}deg) rotateX(${tiltDeg}deg) scale(${scale})`,
    boxShadow: `0 24px 48px rgba(15, 23, 42, 0.16), 0 10px 20px rgba(15, 23, 42, 0.10), 0 0 0 1px ${accentGlow}`,
    filter: "saturate(1.03)",
    zIndex: 40,
  };
}

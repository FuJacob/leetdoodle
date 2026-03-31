import type { CanvasNode, Edge } from "../shared/nodes";
import type { Transform } from "./types";

interface Props {
  nodes: CanvasNode[];
  edges: Edge[];
  transform: Transform;
}

interface Point {
  x: number;
  y: number;
}

interface Anchor {
  point: Point;
  normal: Point;
}

function getNodeCenter(node: CanvasNode): Point {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

/**
 * Returns the intersection point between the node's axis-aligned rectangle
 * and the ray from the node center toward `target`.
 */
function getNodeBorderAnchor(node: CanvasNode, target: Point): Anchor {
  const center = getNodeCenter(node);
  const dx = target.x - center.x;
  const dy = target.y - center.y;

  // Degenerate overlap case: avoid division by zero.
  if (dx === 0 && dy === 0) {
    return {
      point: center,
      normal: { x: 1, y: 0 },
    };
  }

  const halfWidth = Math.max(node.width / 2, 0.0001);
  const halfHeight = Math.max(node.height / 2, 0.0001);
  const normalizedX = Math.abs(dx) / halfWidth;
  const normalizedY = Math.abs(dy) / halfHeight;

  // Decide which side of the rectangle the ray exits from.
  if (normalizedX >= normalizedY) {
    const signX = Math.sign(dx) || 1;
    const edgeX = center.x + signX * halfWidth;
    const edgeY = center.y + (dy * halfWidth) / Math.max(Math.abs(dx), 0.0001);
    return {
      point: { x: edgeX, y: edgeY },
      normal: { x: signX, y: 0 },
    };
  }

  const signY = Math.sign(dy) || 1;
  const edgeY = center.y + signY * halfHeight;
  const edgeX = center.x + (dx * halfHeight) / Math.max(Math.abs(dy), 0.0001);
  return {
    point: { x: edgeX, y: edgeY },
    normal: { x: 0, y: signY },
  };
}

function worldToScreen(point: Point, transform: Transform): Point {
  return {
    x: point.x * transform.zoom + transform.x,
    y: point.y * transform.zoom + transform.y,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function EdgesOverlay({ nodes, edges, transform }: Props) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    // Covers the full viewport. Lives OUTSIDE the transform div so it has a
    // real size. We convert world → screen coords manually instead.
    <svg className="absolute inset-0 w-full h-full pointer-events-none">
      {edges.map((edge) => {
        const from = nodeMap.get(edge.fromNodeId);
        const to   = nodeMap.get(edge.toNodeId);
        if (!from || !to) return null;

        const fromCenter = getNodeCenter(from);
        const toCenter = getNodeCenter(to);

        // Anchor curves to actual node borders instead of geometric centers.
        const fromAnchorWorld = getNodeBorderAnchor(from, toCenter);
        const toAnchorWorld = getNodeBorderAnchor(to, fromCenter);
        const fromAnchor = worldToScreen(fromAnchorWorld.point, transform);
        const toAnchor = worldToScreen(toAnchorWorld.point, transform);

        const dx = toAnchor.x - fromAnchor.x;
        const dy = toAnchor.y - fromAnchor.y;
        const distance = Math.hypot(dx, dy);
        const curveStrength = clamp(distance * 0.35, 24, 140);

        const control1 = {
          x: fromAnchor.x + fromAnchorWorld.normal.x * curveStrength,
          y: fromAnchor.y + fromAnchorWorld.normal.y * curveStrength,
        };
        const control2 = {
          x: toAnchor.x + toAnchorWorld.normal.x * curveStrength,
          y: toAnchor.y + toAnchorWorld.normal.y * curveStrength,
        };
        const pathData = `M ${fromAnchor.x} ${fromAnchor.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${toAnchor.x} ${toAnchor.y}`;

        return (
          <path
            key={edge.id}
            d={pathData}
            stroke="#ffffff"
            strokeWidth={1}
            fill="none"
          />
        );
      })}
    </svg>
  );
}

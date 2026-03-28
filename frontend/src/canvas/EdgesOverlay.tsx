import type { CanvasNode, Edge } from "../shared/nodes";
import type { Transform } from "./types";

interface Props {
  nodes: CanvasNode[];
  edges: Edge[];
  transform: Transform;
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

        // World-space centers → screen-space:  screen = world * zoom + translation
        const x1 = (from.x + from.width  / 2) * transform.zoom + transform.x;
        const y1 = (from.y + from.height / 2) * transform.zoom + transform.y;
        const x2 = (to.x   + to.width   / 2) * transform.zoom + transform.x;
        const y2 = (to.y   + to.height  / 2) * transform.zoom + transform.y;

        return (
          <line
            key={edge.id}
            x1={x1} y1={y1}
            x2={x2} y2={y2}
            stroke="#ffffff"
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}

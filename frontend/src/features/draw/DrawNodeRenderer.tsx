import type { CanvasNode, DrawNode } from "../../shared/nodes";

interface Props {
  node: DrawNode;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => void;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
  dragStyle: React.CSSProperties;
}

export function DrawNodeRenderer({ node, onPointerDown, dragStyle }: Props) {
  const { data } = node;
  const pointsStr = data.points.map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <div
      className="absolute cursor-grab select-none active:cursor-grabbing"
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        ...dragStyle,
      }}
      onPointerDown={(e) => onPointerDown(e, node)}
    >
      <svg width={node.width} height={node.height} className="overflow-visible">
        <polyline
          points={pointsStr}
          fill="none"
          stroke="var(--lc-draw-stroke)"
          strokeWidth={data.thickness}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

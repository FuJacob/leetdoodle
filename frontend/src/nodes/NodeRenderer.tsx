import type { CanvasNode } from '../canvas/types';

interface NodeRendererProps {
  node: CanvasNode;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => void;
}

export function NodeRenderer({ node, onPointerDown }: NodeRendererProps) {
  return (
    <div
      className="absolute cursor-grab select-none rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-300 shadow-xl active:cursor-grabbing"
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        minHeight: node.height,
      }}
      onPointerDown={e => onPointerDown(e, node)}
    >
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-blue-400">
        {node.type}
      </div>
      <div>{String(node.data.content ?? '')}</div>
    </div>
  );
}

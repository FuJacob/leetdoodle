import type { CanvasNode, ProblemNode } from '../canvas/nodes';

interface Props {
  node: ProblemNode;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => void;
}

export function ProblemNodeRenderer({ node, onPointerDown }: Props) {
  return (
    <div
      className="absolute cursor-grab select-none border border-zinc-700 bg-zinc-900 p-3 active:cursor-grabbing"
      style={{ left: node.x, top: node.y, width: node.width, minHeight: node.height }}
      onPointerDown={e => onPointerDown(e, node)}
    >
      <div className="mb-1 text-xs font-semibold text-zinc-400">Problem</div>
      <div className="mb-1 text-sm font-medium text-zinc-100">{node.data.title}</div>
      <div className="text-xs text-zinc-400">{node.data.description || 'No description'}</div>
    </div>
  );
}

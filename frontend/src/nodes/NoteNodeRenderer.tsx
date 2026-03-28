import type { CanvasNode, NoteNode } from '../canvas/nodes';

interface Props {
  node: NoteNode;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => void;
}

export function NoteNodeRenderer({ node, onPointerDown }: Props) {
  return (
    <div
      className="absolute cursor-grab select-none rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl active:cursor-grabbing"
      style={{ left: node.x, top: node.y, width: node.width, minHeight: node.height }}
      onPointerDown={e => onPointerDown(e, node)}
    >
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-yellow-500">
        Note
      </div>
      <div className="text-sm text-zinc-300">
        {node.data.content || <span className="text-zinc-600 italic">Empty note</span>}
      </div>
    </div>
  );
}

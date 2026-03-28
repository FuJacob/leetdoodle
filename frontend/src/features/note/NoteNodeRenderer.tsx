import type { CanvasNode, NoteNode } from "../../shared/nodes";

interface Props {
  node: NoteNode;
  onPointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    node: CanvasNode,
  ) => void;
}

export function NoteNodeRenderer({ node, onPointerDown }: Props) {
  return (
    <div
      className="absolute cursor-grab select-none border border-zinc-700 bg-zinc-900 p-3 active:cursor-grabbing"
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
      }}
      onPointerDown={(e) => onPointerDown(e, node)}
    >
      <div className="mb-2 text-xs font-semibold text-zinc-400">Note</div>
      <div
        className="h-full"
        style={{ height: node.height - 50 }} // subtract header + padding
        onPointerDown={(e) => e.stopPropagation()}
      >
        <textarea
          placeholder="Write a note..."
          className="w-full h-full bg-zinc-800 text-zinc-100 text-sm p-2 border border-zinc-700 resize-none outline-none placeholder:text-zinc-500"
        />
      </div>
    </div>
  );
}

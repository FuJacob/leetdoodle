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
        minHeight: node.height,
      }}
      onPointerDown={(e) => onPointerDown(e, node)}
    >
      <div className="mb-1 text-xs font-semibold text-zinc-400">Note</div>
      <div onPointerDown={(e) => e.stopPropagation()}>
        <textarea
          name="note-pad"
          id=""
          placeholder="Write a note..."
          className="text-white text-sm w-full h-full"
        ></textarea>
      </div>
    </div>
  );
}

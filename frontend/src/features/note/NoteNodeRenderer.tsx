import { useEffect, useRef } from 'react';
import type { TextEdit } from '../../shared/crdt';
import type { CanvasNode, NoteNode } from '../../shared/nodes';

interface Props {
  node: NoteNode;
  onPointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    node: CanvasNode,
  ) => void;
  onTextEdits: (nodeId: string, edits: TextEdit[]) => void;
}

/**
 * Computes one minimal replacement edit from previous -> next string.
 *
 * Why one edit?
 * Textarea onChange provides full value snapshots, not granular operations.
 * We derive a prefix/suffix diff so CRDT still receives position-based edits.
 */
function diffToSingleEdit(prev: string, next: string): TextEdit[] {
  if (prev === next) return [];

  let prefix = 0;
  while (prefix < prev.length && prefix < next.length && prev[prefix] === next[prefix]) {
    prefix++;
  }

  let prevSuffix = prev.length;
  let nextSuffix = next.length;
  while (prevSuffix > prefix && nextSuffix > prefix && prev[prevSuffix - 1] === next[nextSuffix - 1]) {
    prevSuffix--;
    nextSuffix--;
  }

  return [{
    from: prefix,
    to: prevSuffix,
    insert: next.slice(prefix, nextSuffix),
  }];
}

export function NoteNodeRenderer({ node, onPointerDown, onTextEdits }: Props) {
  const lastTextRef = useRef(node.data.content);

  useEffect(() => {
    lastTextRef.current = node.data.content;
  }, [node.data.content]);

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
          value={node.data.content}
          className="w-full h-full bg-zinc-800 text-zinc-100 text-sm p-2 border border-zinc-700 resize-none outline-none placeholder:text-zinc-500"
          onChange={(e) => {
            const next = e.target.value;
            const edits = diffToSingleEdit(lastTextRef.current, next);
            if (edits.length > 0) {
              onTextEdits(node.id, edits);
            }
            lastTextRef.current = next;
          }}
        />
      </div>
    </div>
  );
}

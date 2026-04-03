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
  dragStyle: React.CSSProperties;
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

export function NoteNodeRenderer({
  node,
  onPointerDown,
  onTextEdits,
  dragStyle,
}: Props) {
  const lastTextRef = useRef(node.data.content);

  useEffect(() => {
    lastTextRef.current = node.data.content;
  }, [node.data.content]);

  return (
    <div
      className="absolute flex cursor-grab select-none flex-col overflow-hidden border border-(--lc-border-default) bg-(--lc-surface-1) active:cursor-grabbing"
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        ...dragStyle,
      }}
      onPointerDown={(e) => onPointerDown(e, node)}
    >
      <div className="border-b border-(--lc-border-default) px-3 py-2 text-xs font-semibold text-(--lc-text-secondary)">
        Note
      </div>
      <div
        className="flex-1 min-h-0 p-3"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <textarea
          placeholder="Write a note..."
          value={node.data.content}
          className="h-full w-full resize-none border border-(--lc-border-default) bg-(--lc-surface-2) p-2 text-sm text-(--lc-text-primary) outline-none placeholder:text-(--lc-text-muted)"
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

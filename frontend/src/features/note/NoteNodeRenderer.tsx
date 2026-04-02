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
      className="w2k-window absolute cursor-grab select-none active:cursor-grabbing"
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        display: "flex",
        flexDirection: "column",
      }}
      onPointerDown={(e) => onPointerDown(e, node)}
    >
      {/* Win2000 title bar */}
      <div className="w2k-titlebar" style={{ flexShrink: 0 }}>
        <span style={{ fontSize: 10 }}>📝</span>
        <span>Note</span>
      </div>
      {/* Content */}
      <div
        style={{ flex: 1, padding: 4, minHeight: 0 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <textarea
          placeholder="Write a note..."
          value={node.data.content}
          className="w2k-input"
          style={{
            width: "100%",
            height: "100%",
            resize: "none",
            fontSize: 11,
            fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Tahoma, Arial, sans-serif',
            background: "#ffffff",
            boxSizing: "border-box",
          }}
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

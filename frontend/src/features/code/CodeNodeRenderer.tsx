import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import type { TextEdit } from "../../shared/crdt";
import type { CanvasNode, CodeNode } from "../../shared/nodes";

interface Props {
  node: CodeNode;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => void;
  onTextEdits: (nodeId: string, edits: TextEdit[]) => void;
}

function getLanguageExtension(lang: string) {
  switch (lang) {
    case "python":
      return python();
    case "javascript":
    default:
      return javascript();
  }
}

export function CodeNodeRenderer({ node, onPointerDown, onTextEdits }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      doc: node.data.content,
      extensions: [
        basicSetup,
        getLanguageExtension(node.data.language),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          if (applyingRemoteRef.current) return;

          const edits: TextEdit[] = [];

          // CodeMirror reports edits in pre-change coordinates.
          // We forward those raw ranges to CRDTDocument.applyLocalEdits.
          update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
            edits.push({
              from: fromA,
              to: toA,
              insert: inserted.toString(),
            });
          });

          if (edits.length > 0) {
            onTextEdits(node.id, edits);
          }
        }),
        EditorView.theme({
          "&": { backgroundColor: "#18181b", color: "#e4e4e7" },
          ".cm-content": { caretColor: "#e4e4e7" },
          ".cm-cursor": { borderLeftColor: "#e4e4e7" },
          ".cm-gutters": { backgroundColor: "#18181b", color: "#71717a", border: "none" },
          ".cm-activeLineGutter": { backgroundColor: "#27272a" },
          ".cm-activeLine": { backgroundColor: "#27272a" },
        }),
      ],
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount-only editor creation. Remote updates are applied via separate effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current === node.data.content) return;

    applyingRemoteRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: node.data.content,
      },
    });
    applyingRemoteRef.current = false;
  }, [node.data.content]);

  return (
    <div
      className="absolute cursor-grab select-none border border-zinc-700 bg-zinc-900 active:cursor-grabbing"
      style={{ left: node.x, top: node.y, width: node.width }}
      onPointerDown={(e) => onPointerDown(e, node)}
    >
      <div className="flex items-center justify-between p-2 border-b border-zinc-700">
        <span className="text-xs font-semibold text-zinc-400">Code</span>
        <span className="text-[10px] text-zinc-500">{node.data.language}</span>
      </div>
      <div
        ref={containerRef}
        className="text-sm overflow-auto"
        style={{ height: node.height - 40 }} // subtract header height
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

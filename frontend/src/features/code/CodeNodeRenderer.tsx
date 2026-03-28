import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import type { CanvasNode, CodeNode } from "../../shared/nodes";

interface Props {
  node: CodeNode;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => void;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
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

export function CodeNodeRenderer({ node, onPointerDown, onUpdate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      doc: node.data.content,
      extensions: [
        basicSetup,
        getLanguageExtension(node.data.language),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const content = update.state.doc.toString();
            onUpdate(node.id, { data: { ...node.data, content } });
          }
        }),
        // Dark theme to match the canvas
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
    // Only run on mount — we don't want to recreate the editor on every content change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {/* Stop pointer events so typing/selecting doesn't trigger drag */}
      <div
        ref={containerRef}
        className="text-sm"
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

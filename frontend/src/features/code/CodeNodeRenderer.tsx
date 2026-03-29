import { useEffect, useMemo, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import type { TextEdit } from "../../shared/crdt";
import type {
  CanvasNode,
  CodeNode,
  Edge,
  NodeType,
  ProblemNode,
  TestResultsData,
  TestResultsNode,
} from "../../shared/nodes";
import { runCodeStub } from "../test-results/runStub";

interface Props {
  node: CodeNode;
  nodes: CanvasNode[];
  edges: Edge[];
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => void;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
  onSpawn: (type: NodeType, fromNodeId?: string) => string | undefined;
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

function isProblemNode(node: CanvasNode | undefined): node is ProblemNode {
  return !!node && node.type === "problem";
}

function isTestResultsNode(node: CanvasNode | undefined): node is TestResultsNode {
  return !!node && node.type === "test-results";
}

function patchResultsNode(
  nodeId: string,
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void,
  patch: Partial<TestResultsData>,
  previous?: TestResultsData,
) {
  const current: TestResultsData =
    previous ?? {
      mode: "result",
      runState: "idle",
      runtimeMs: null,
      selectedCaseIndex: 0,
      cases: [],
    };

  onUpdate(nodeId, {
    data: {
      ...current,
      ...patch,
    },
  } as Partial<CanvasNode>);
}

export function CodeNodeRenderer({
  node,
  nodes,
  edges,
  onPointerDown,
  onUpdate,
  onSpawn,
  onTextEdits,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const applyingRemoteRef = useRef(false);

  const connectedProblem = useMemo(() => {
    for (const edge of edges) {
      if (edge.toNodeId === node.id) {
        const candidate = nodes.find((n) => n.id === edge.fromNodeId);
        if (isProblemNode(candidate)) return candidate;
      }
      if (edge.fromNodeId === node.id) {
        const candidate = nodes.find((n) => n.id === edge.toNodeId);
        if (isProblemNode(candidate)) return candidate;
      }
    }
    return null;
  }, [edges, nodes, node.id]);

  const connectedResults = useMemo(() => {
    for (const edge of edges) {
      if (edge.fromNodeId !== node.id) continue;
      const candidate = nodes.find((n) => n.id === edge.toNodeId);
      if (isTestResultsNode(candidate)) return candidate;
    }
    return null;
  }, [edges, nodes, node.id]);

  const canRun = !!connectedProblem;
  const isRunning = connectedResults?.data.runState === "running";

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

  async function handleRunClick() {
    if (!connectedProblem) return;

    const existingResults = connectedResults;
    const spawnedNodeId = existingResults ? undefined : onSpawn("test-results", node.id);
    const resultsNodeId = existingResults?.id ?? spawnedNodeId;

    if (!resultsNodeId) return;

    patchResultsNode(
      resultsNodeId,
      onUpdate,
      {
        mode: "result",
        runState: "running",
        runtimeMs: null,
        selectedCaseIndex: 0,
      },
      existingResults?.data,
    );

    try {
      const problemId =
        connectedProblem.data.status === "loaded"
          ? connectedProblem.data.slug
          : connectedProblem.id;

      const stub = await runCodeStub(problemId, node.data.content);
      const firstFail = stub.cases.findIndex((c) => !c.passed);

      patchResultsNode(resultsNodeId, onUpdate, {
        mode: "result",
        runState: stub.runState,
        runtimeMs: stub.runtimeMs,
        selectedCaseIndex: firstFail >= 0 ? firstFail : 0,
        cases: stub.cases,
        errorMessage: stub.errorMessage,
        lastExecutedInput: stub.lastExecutedInput,
      });
    } catch (error) {
      patchResultsNode(resultsNodeId, onUpdate, {
        mode: "result",
        runState: "runtime_error",
        runtimeMs: 0,
        selectedCaseIndex: 0,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <div
      className="absolute cursor-grab select-none border border-zinc-700 bg-zinc-900 active:cursor-grabbing"
      style={{ left: node.x, top: node.y, width: node.width }}
      onPointerDown={(e) => onPointerDown(e, node)}
    >
      <div className="flex items-center justify-between border-b border-zinc-700 p-2">
        <span className="text-xs font-semibold text-zinc-400">Code</span>
        <div className="flex items-center gap-2">
          {canRun && (
            <button
              type="button"
              className="rounded bg-zinc-700 px-2 py-1 text-[10px] font-semibold text-zinc-100 hover:bg-zinc-600 disabled:opacity-50"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleRunClick}
              disabled={isRunning}
            >
              {isRunning ? "Running…" : "Run"}
            </button>
          )}
          <span className="text-[10px] text-zinc-500">{node.data.language}</span>
        </div>
      </div>
      <div
        ref={containerRef}
        className="overflow-auto text-sm"
        style={{ height: node.height - 40 }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

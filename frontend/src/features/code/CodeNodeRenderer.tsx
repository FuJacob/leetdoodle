import { useEffect, useMemo, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import {
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { tags } from "@lezer/highlight";
import { keymap } from "@codemirror/view";
import type { TextEdit } from "../../shared/crdt";
import { useTheme } from "../../theme/useTheme";
import type {
  CanvasNode,
  CodeNode,
  Edge,
  NodeType,
  ProblemNode,
  TestResultsCase,
  TestResultsData,
  TestResultsNode,
  TestResultsRunState,
} from "../../shared/nodes";
import { SUBMISSIONS_SERVICE_URL } from "../../shared/config/env";

const SUBMISSIONS_URL = `${SUBMISSIONS_SERVICE_URL}/api/submissions`;
const TERMINAL_STATUSES = new Set(["ACCEPTED", "WRONG_ANSWER", "RUNTIME_ERROR", "TIME_LIMIT_EXCEEDED"]);

function statusToRunState(status: string): TestResultsRunState {
  switch (status) {
    case "ACCEPTED":            return "accepted";
    case "WRONG_ANSWER":        return "wrong_answer";
    case "RUNTIME_ERROR":       return "runtime_error";
    case "TIME_LIMIT_EXCEEDED": return "time_limit_exceeded";
    default:                    return "runtime_error";
  }
}

interface Props {
  node: CodeNode;
  nodes: CanvasNode[];
  edges: Edge[];
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => void;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
  onSpawn: (type: NodeType, fromNodeId?: string) => string | undefined;
  onTextEdits: (nodeId: string, edits: TextEdit[]) => void;
  dragStyle: React.CSSProperties;
}

function getLanguageExtension() {
  return python();
}

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value.length > 0 ? value : fallback;
}

function createCodeHighlightStyle() {
  return HighlightStyle.define([
    { tag: [tags.keyword, tags.controlKeyword], color: cssVar("--lc-editor-keyword", "#0f5bd8") },
    { tag: [tags.comment, tags.lineComment, tags.blockComment], color: cssVar("--lc-editor-comment", "#7a6857"), fontStyle: "italic" },
    { tag: [tags.string, tags.special(tags.string)], color: cssVar("--lc-editor-string", "#b45309") },
    { tag: [tags.number, tags.integer, tags.float], color: cssVar("--lc-editor-number", "#b91c1c") },
    { tag: [tags.bool, tags.null, tags.atom], color: cssVar("--lc-editor-constant", "#7c2d12") },
    { tag: [tags.function(tags.variableName), tags.labelName], color: cssVar("--lc-editor-function", "#0f766e") },
    { tag: [tags.definition(tags.variableName), tags.variableName], color: cssVar("--lc-editor-variable", "#18181b") },
    { tag: [tags.typeName, tags.className], color: cssVar("--lc-editor-type", "#8b5e00") },
    { tag: [tags.operator, tags.punctuation, tags.separator], color: cssVar("--lc-editor-operator", "#57534e") },
  ]);
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
  dragStyle,
}: Props) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const applyingRemoteRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cancel any in-flight poll when the component unmounts
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

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

  const starterCode =
    connectedProblem?.data.status === "loaded"
      ? (connectedProblem.data.starterCode ?? null)
      : null;

  useEffect(() => {
    if (!starterCode) return;
    onUpdate(node.id, { data: { content: starterCode, language: "python" } });
  }, [starterCode, node.id, onUpdate]);

  const canRun = !!connectedProblem;
  const isRunning = connectedResults?.data.runState === "running";

  useEffect(() => {
    if (!containerRef.current) return;

    const editorBackground = cssVar("--lc-editor-bg", "#18181b");
    const editorText = cssVar("--lc-text-primary", "#e4e4e7");
    const editorGutter = cssVar("--lc-editor-gutter", "#18181b");
    const editorMuted = cssVar("--lc-text-muted", "#71717a");
    const editorActiveLine = cssVar("--lc-editor-active-line", "#27272a");
    const editorCaret = cssVar("--lc-editor-caret", "#e4e4e7");
    const editorSelection = cssVar("--lc-editor-selection", "rgba(58, 124, 242, 0.22)");
    const editorPanel = cssVar("--lc-surface-1", "#ffffff");
    const highlightStyle = createCodeHighlightStyle();
    const isDarkTheme = theme === "dark";

    const view = new EditorView({
      doc: node.data.content,
      extensions: [
        keymap.of([indentWithTab]),
        basicSetup,
        getLanguageExtension(),
        indentUnit.of("    "),
        syntaxHighlighting(highlightStyle),
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
          "&": {
            backgroundColor: editorBackground,
            color: editorText,
            height: "100%",
          },
          ".cm-editor": { height: "100%" },
          ".cm-content": { caretColor: editorCaret, whiteSpace: "pre", minHeight: "100%" },
          ".cm-cursor": { borderLeftColor: editorCaret },
          ".cm-scroller": { overflow: "auto" },
          ".cm-focused": { outline: "none" },
          ".cm-gutters": {
            backgroundColor: editorGutter,
            color: editorMuted,
            border: "none",
          },
          ".cm-selectionBackground, ::selection": {
            backgroundColor: editorSelection,
          },
          ".cm-activeLineGutter": { backgroundColor: editorActiveLine },
          ".cm-activeLine": { backgroundColor: editorActiveLine },
          ".cm-panels": {
            backgroundColor: editorPanel,
            color: editorText,
          },
        }, { dark: isDarkTheme }),
      ],
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Re-create only when theme changes. Doc updates are handled by the
    // separate syncing effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

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
    if (!connectedProblem || connectedProblem.data.status !== "loaded") return;
    if (intervalRef.current) return; // already polling

    const codeForSubmission = viewRef.current?.state.doc.toString() ?? node.data.content;

    const { questionId } = connectedProblem.data;
    const existingResults = connectedResults;
    const spawnedNodeId = existingResults ? undefined : onSpawn("test-results", node.id);
    const resultsNodeId = existingResults?.id ?? spawnedNodeId;
    if (!resultsNodeId) return;

    patchResultsNode(resultsNodeId, onUpdate, {
      mode: "result",
      runState: "running",
      runtimeMs: null,
      selectedCaseIndex: 0,
      cases: [],
    }, existingResults?.data);

    try {
      const postRes = await fetch(SUBMISSIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          userId: "anonymous",
          language: node.data.language,
          code: codeForSubmission,
        }),
      });
      if (!postRes.ok) throw new Error(`Submit failed: ${postRes.status}`);
      const { submissionId } = await postRes.json() as { submissionId: string };

      intervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`${SUBMISSIONS_URL}/${submissionId}`);
          if (!pollRes.ok) return; // transient — retry next tick

          const submission = await pollRes.json() as { status: string; result: string | null };
          if (!TERMINAL_STATUSES.has(submission.status)) return; // still running

          clearInterval(intervalRef.current!);
          intervalRef.current = null;

          const runState = statusToRunState(submission.status);
          const parsed = submission.result
            ? (JSON.parse(submission.result) as {
                cases: Array<{ input: string; expected: string; actual: string | null; passed: boolean; error: string | null }>;
                errorMessage: string | null;
              })
            : null;

          const cases: TestResultsCase[] = (parsed?.cases ?? []).map((c) => ({
            input: c.input,
            output: c.actual,
            expected: c.expected,
            passed: c.passed,
            error: c.error,
          }));

          const firstFail = cases.findIndex((c) => !c.passed);
          patchResultsNode(resultsNodeId, onUpdate, {
            mode: "result",
            runState,
            runtimeMs: 0, // TODO: implement runtime tracking in worker
            cases,
            selectedCaseIndex: firstFail >= 0 ? firstFail : 0,
            errorMessage: parsed?.errorMessage ?? undefined,
            lastExecutedInput: cases.find((c) => c.error != null)?.input,
          }, existingResults?.data);

        } catch {
          // transient poll error — retry on next tick
        }
      }, 500);

    } catch (error) {
      patchResultsNode(resultsNodeId, onUpdate, {
        mode: "result",
        runState: "runtime_error",
        runtimeMs: 0,
        selectedCaseIndex: 0,
        cases: [],
        errorMessage: error instanceof Error ? error.message : String(error),
      }, existingResults?.data);
    }
  }

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
      <div className="flex items-center justify-between border-b border-(--lc-border-default) p-2">
        <span className="text-xs font-semibold text-(--lc-text-secondary)">Code</span>
        <div className="flex items-center gap-2">
          {canRun && (
            <button
              type="button"
              className="rounded border border-(--lc-border-default) bg-(--lc-surface-3) px-2 py-1 text-[10px] font-semibold text-(--lc-text-primary) transition hover:border-(--lc-border-focus) hover:text-(--lc-accent) disabled:opacity-50"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleRunClick}
              disabled={isRunning}
            >
              {isRunning ? "Running…" : "Run"}
            </button>
          )}
          <span className="text-[10px] text-(--lc-text-muted)">{node.data.language}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0" onPointerDown={(e) => e.stopPropagation()}>
        <div ref={containerRef} className="h-full overflow-auto text-sm" />
      </div>
    </div>
  );
}

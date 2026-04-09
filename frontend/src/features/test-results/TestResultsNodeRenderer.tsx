import { IconListCheck } from "@tabler/icons-react";
import type {
  CanvasNode,
  TestResultsData,
  TestResultsNode,
} from "../../shared/nodes";
import { NodeHeader } from "../shared/NodeHeader";

interface Props {
  node: TestResultsNode;
  onPointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    node: CanvasNode,
  ) => void;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
  dragStyle: React.CSSProperties;
}

function panel(text: string | null) {
  return text ?? "—";
}

function ValueBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-[10px] font-semibold text-(--lc-text-muted)">{label}</div>
      <div className="whitespace-pre-wrap border border-(--lc-border-default) bg-(--lc-surface-2) p-2 font-mono text-xs text-(--lc-text-primary)">
        {panel(value)}
      </div>
    </div>
  );
}

function updateResultsData(
  node: TestResultsNode,
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void,
  patch: Partial<TestResultsData>,
) {
  onUpdate(node.id, {
    data: { ...node.data, ...patch },
  } as Partial<CanvasNode>);
}

export function TestResultsNodeRenderer({
  node,
  onPointerDown,
  onUpdate,
  dragStyle,
}: Props) {
  const { data } = node;
  const testcaseCases = data.testcaseCases;
  const resultCases = data.resultCases;
  const selectedTestcase = testcaseCases[0] ?? null;
  const selectedResult = resultCases[0] ?? null;
  const accepted = data.runState === "accepted";
  const runtimeError = data.runState === "runtime_error";
  const timeLimitExceeded = data.runState === "time_limit_exceeded";
  const isError = runtimeError || timeLimitExceeded;
  const running = data.runState === "running";

  const statusLabel =
    accepted ? "Accepted"
    : runtimeError ? "Runtime Error"
    : timeLimitExceeded ? "Time Limit Exceeded"
    : data.runState === "wrong_answer" ? "Wrong Answer"
    : null;

  const statusColor =
    accepted ? "text-(--lc-success)"
    : isError ? "text-(--lc-danger)"
    : "text-(--lc-warning)";

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
      {/* Header */}
      <div>
        <NodeHeader
          title="Test Results"
          Icon={IconListCheck}
          right={
            statusLabel
              ? <span className={`text-[10px] font-semibold ${statusColor}`}>{statusLabel}</span>
              : undefined
          }
          className="border-b-0"
        />
        <div className="flex items-center gap-3 border-b border-(--lc-border-default) px-3 pb-2">
          <button
            type="button"
            className={`text-xs font-semibold ${
              data.mode === "testcase"
                ? "text-(--lc-text-primary)"
                : "text-(--lc-text-muted)"
            }`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => updateResultsData(node, onUpdate, { mode: "testcase" })}
          >
            Testcase
          </button>
          <span className="text-(--lc-text-muted)">|</span>
          <button
            type="button"
            className={`text-xs font-semibold ${
              data.mode === "result"
                ? "text-(--lc-text-primary)"
                : "text-(--lc-text-muted)"
            }`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => updateResultsData(node, onUpdate, { mode: "result" })}
          >
            Test Result
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-3"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Testcase mode */}
        {data.mode === "testcase" && (
          <>
            {testcaseCases.length === 0 && (
              <p className="text-xs text-(--lc-text-muted)">Run to see test cases.</p>
            )}
            {selectedTestcase && (
              <ValueBlock label="Input" value={selectedTestcase.input} />
            )}
          </>
        )}

        {/* Result mode — running */}
        {data.mode === "result" && running && (
          <p className="text-xs text-(--lc-text-secondary)">Running…</p>
        )}

        {/* Result mode — done */}
        {data.mode === "result" && !running && (
          <>
            {isError && data.errorMessage && (
              <div className="mb-3 whitespace-pre-wrap border border-(--lc-danger) bg-(--lc-danger-bg-soft) p-2 font-mono text-xs text-(--lc-danger)">
                {data.errorMessage}
              </div>
            )}

            {selectedResult && (
              <>
                <ValueBlock
                  label={isError ? "Last Executed Input" : "Input"}
                  value={isError ? (data.lastExecutedInput ?? selectedResult.input) : selectedResult.input}
                />

                {!isError && (
                  <>
                    <ValueBlock label="Output" value={selectedResult.output} />
                    <ValueBlock label="Expected" value={selectedResult.expected} />
                  </>
                )}

                {isError && (
                  <button
                    type="button"
                    className="text-[10px] text-(--lc-text-secondary) transition hover:text-(--lc-accent)"
                    onClick={() => updateResultsData(node, onUpdate, { mode: "testcase" })}
                  >
                    Open Testcase ↗
                  </button>
                )}
              </>
            )}

            {!selectedResult && accepted && (
              <p className="text-xs text-(--lc-text-secondary)">All submitted test cases passed.</p>
            )}

            {!selectedResult && !accepted && !running && (
              <p className="text-xs text-(--lc-text-muted)">No failing case to show yet.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

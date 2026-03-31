import type {
  CanvasNode,
  TestResultsData,
  TestResultsNode,
} from "../../shared/nodes";

interface Props {
  node: TestResultsNode;
  onPointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    node: CanvasNode,
  ) => void;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
}

function panel(text: string | null) {
  return text ?? "—";
}

function CaseTab({
  label,
  active,
  passed,
  onClick,
}: {
  label: string;
  active: boolean;
  passed: boolean | null;
  onClick?: () => void;
}) {
  const indicator =
    passed === true ? <span className="text-green-500">✓</span>
    : passed === false ? <span className="text-red-500">✕</span>
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 border px-2 py-0.5 text-[10px] font-semibold ${
        active
          ? "border-zinc-500 bg-zinc-700 text-zinc-100"
          : "border-zinc-700 bg-transparent text-zinc-400"
      }`}
      disabled={!onClick}
    >
      {indicator}
      {label}
    </button>
  );
}

function ValueBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-[10px] font-semibold text-zinc-500">{label}</div>
      <div className="border border-zinc-700 bg-zinc-800 p-2 font-mono text-xs text-zinc-100 whitespace-pre-wrap">
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

export function TestResultsNodeRenderer({ node, onPointerDown, onUpdate }: Props) {
  const { data } = node;
  const hasCases = data.cases.length > 0;
  const selected = data.cases[data.selectedCaseIndex] ?? null;
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
    accepted ? "text-green-500"
    : isError ? "text-red-400"
    : "text-yellow-400";

  return (
    <div
      className="absolute cursor-grab select-none overflow-hidden border border-zinc-700 bg-zinc-900 active:cursor-grabbing"
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      onPointerDown={(e) => onPointerDown(e, node)}
    >
      {/* Header — mode tabs */}
      <div
        className="flex items-center justify-between border-b border-zinc-700 p-2"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={`text-xs font-semibold ${
              data.mode === "testcase" ? "text-zinc-100" : "text-zinc-500"
            }`}
            onClick={() => updateResultsData(node, onUpdate, { mode: "testcase" })}
          >
            Testcase
          </button>
          <span className="text-zinc-600">|</span>
          <button
            type="button"
            className={`text-xs font-semibold ${
              data.mode === "result" ? "text-zinc-100" : "text-zinc-500"
            }`}
            onClick={() => updateResultsData(node, onUpdate, { mode: "result" })}
          >
            Test Result
          </button>
        </div>
        {statusLabel && (
          <span className={`text-[10px] font-semibold ${statusColor}`}>{statusLabel}</span>
        )}
      </div>

      {/* Body */}
      <div
        className="h-[calc(100%-33px)] overflow-y-auto p-3"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Case selector row — shared between both modes */}
        {hasCases && (
          <div className="mb-3 flex flex-wrap gap-1">
            {data.cases.map((c, idx) => (
              <CaseTab
                key={idx}
                label={`Case ${idx + 1}`}
                active={idx === data.selectedCaseIndex}
                passed={data.mode === "result" ? c.passed : null}
                onClick={() => updateResultsData(node, onUpdate, { selectedCaseIndex: idx })}
              />
            ))}
          </div>
        )}

        {/* Testcase mode */}
        {data.mode === "testcase" && (
          <>
            {!hasCases && (
              <p className="text-xs text-zinc-500">Run to see test cases.</p>
            )}
            {selected && (
              <ValueBlock label="Input" value={selected.input} />
            )}
          </>
        )}

        {/* Result mode — running */}
        {data.mode === "result" && running && (
          <p className="text-xs text-zinc-400">Running…</p>
        )}

        {/* Result mode — done */}
        {data.mode === "result" && !running && (
          <>
            {isError && data.errorMessage && (
              <div className="mb-3 border border-red-900 bg-red-950/20 p-2 font-mono text-xs text-red-400 whitespace-pre-wrap">
                {data.errorMessage}
              </div>
            )}

            {selected && (
              <>
                <ValueBlock
                  label={isError ? "Last Executed Input" : "Input"}
                  value={isError ? (data.lastExecutedInput ?? selected.input) : selected.input}
                />

                {!isError && (
                  <>
                    <ValueBlock label="Output" value={selected.output} />
                    <ValueBlock label="Expected" value={selected.expected} />
                  </>
                )}

                {isError && (
                  <button
                    type="button"
                    className="text-[10px] text-zinc-400 hover:text-zinc-200"
                    onClick={() => updateResultsData(node, onUpdate, { mode: "testcase" })}
                  >
                    Open Testcase ↗
                  </button>
                )}
              </>
            )}

            {!hasCases && !running && (
              <p className="text-xs text-zinc-500">No results yet.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

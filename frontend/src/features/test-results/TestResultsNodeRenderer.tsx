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

function CasePill({
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-5 py-2 text-2xl font-semibold transition ${
        active
          ? "bg-zinc-700 text-zinc-100"
          : "bg-transparent text-zinc-400 hover:bg-zinc-800"
      }`}
      disabled={!onClick}
    >
      {passed !== null && <span className={passed ? "text-green-500" : "text-red-500"}>{passed ? "✓" : "✕"}</span>} {label}
    </button>
  );
}

function updateResultsData(
  node: TestResultsNode,
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void,
  patch: Partial<TestResultsData>,
) {
  onUpdate(node.id, {
    data: {
      ...node.data,
      ...patch,
    },
  } as Partial<CanvasNode>);
}

export function TestResultsNodeRenderer({ node, onPointerDown, onUpdate }: Props) {
  const { data } = node;
  const hasCases = data.cases.length > 0;
  const selected = data.cases[data.selectedCaseIndex] ?? null;
  const accepted = data.runState === "accepted";
  const runtimeError = data.runState === "runtime_error";
  const running = data.runState === "running";

  return (
    <div
      className="absolute select-none overflow-hidden rounded-2xl border border-zinc-600 bg-zinc-900"
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      onPointerDown={(e) => onPointerDown(e, node)}
    >
      <div
        className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800/80 px-5 py-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 text-4xl leading-none">
          <button
            type="button"
            className={`rounded-xl px-3 py-2 font-semibold ${
              data.mode === "testcase" ? "bg-zinc-700 text-zinc-100" : "text-zinc-400"
            }`}
            onClick={() => updateResultsData(node, onUpdate, { mode: "testcase" })}
          >
            <span className="text-green-600">☑</span> Testcase
          </button>
          <span className="text-zinc-500">|</span>
          <button
            type="button"
            className={`font-semibold ${
              data.mode === "result" ? "text-zinc-100" : "text-zinc-400"
            }`}
            onClick={() => updateResultsData(node, onUpdate, { mode: "result" })}
          >
            <span className="text-green-600">&gt;_</span> Test Result
          </button>
        </div>

        <div className="text-zinc-400">⌃</div>
      </div>

      <div className="h-[calc(100%-78px)] overflow-y-auto p-6" onPointerDown={(e) => e.stopPropagation()}>
        {data.mode === "testcase" && (
          <>
            <div className="mb-6 flex items-center gap-3">
              {hasCases ? (
                data.cases.map((_, idx) => (
                  <CasePill
                    key={idx}
                    label={`Case ${idx + 1}`}
                    active={idx === data.selectedCaseIndex}
                    passed={null}
                    onClick={() =>
                      updateResultsData(node, onUpdate, { selectedCaseIndex: idx })
                    }
                  />
                ))
              ) : (
                <div className="text-2xl text-zinc-500">Run to populate 3 sample test cases.</div>
              )}
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-4xl text-zinc-500"
                disabled
                title="Run-only flow currently uses fixed 3 sample cases"
              >
                +
              </button>
            </div>

            <div className="mb-2 text-4xl font-semibold text-zinc-400">Input</div>
            <div className="rounded-3xl bg-zinc-700/60 p-6 text-4xl text-zinc-100">
              {panel(selected?.input ?? null)}
            </div>
          </>
        )}

        {data.mode === "result" && running && (
          <div className="text-4xl font-semibold text-zinc-200">Running sample test cases…</div>
        )}

        {data.mode === "result" && !running && (
          <>
            <div className="mb-5 flex items-center gap-5 text-6xl font-semibold">
              <span className={accepted ? "text-green-500" : runtimeError ? "text-red-500" : "text-yellow-400"}>
                {accepted ? "Accepted" : runtimeError ? "Runtime Error" : "Wrong Answer"}
              </span>
              <span className="text-5xl text-zinc-400">Runtime: {data.runtimeMs ?? 0} ms</span>
            </div>

            {runtimeError && data.errorMessage && (
              <div className="mb-6 rounded-3xl bg-red-950/30 p-6 text-4xl text-red-400 whitespace-pre-wrap">
                {data.errorMessage}
              </div>
            )}

            <div className="mb-6 flex items-center gap-4">
              {hasCases &&
                data.cases.map((c, idx) => (
                  <CasePill
                    key={idx}
                    label={`Case ${idx + 1}`}
                    active={idx === data.selectedCaseIndex}
                    passed={c.passed}
                    onClick={() =>
                      updateResultsData(node, onUpdate, { selectedCaseIndex: idx })
                    }
                  />
                ))}
            </div>

            {selected && (
              <>
                <div className="mb-2 text-4xl font-semibold text-zinc-400">
                  {runtimeError ? "Last Executed Input" : "Input"}
                </div>
                <div className="mb-5 rounded-3xl bg-zinc-700/60 p-6 text-4xl text-zinc-100">
                  {panel(runtimeError ? data.lastExecutedInput ?? selected.input : selected.input)}
                </div>

                {!runtimeError && (
                  <>
                    <div className="mb-2 text-4xl font-semibold text-zinc-400">Output</div>
                    <div className="mb-5 rounded-3xl bg-zinc-700/60 p-6 text-4xl text-zinc-100">
                      {panel(selected.output)}
                    </div>

                    <div className="mb-2 text-4xl font-semibold text-zinc-400">Expected</div>
                    <div className="mb-5 rounded-3xl bg-zinc-700/60 p-6 text-4xl text-zinc-100">
                      {panel(selected.expected)}
                    </div>
                  </>
                )}

                {runtimeError && (
                  <button
                    type="button"
                    className="text-3xl font-semibold text-zinc-300 hover:text-zinc-100"
                    onClick={() =>
                      updateResultsData(node, onUpdate, {
                        mode: "testcase",
                      })
                    }
                  >
                    Open Testcase ↗
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

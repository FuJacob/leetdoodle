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
    passed === true ? <span style={{ color: "var(--w2k-green)" }}>✓</span>
    : passed === false ? <span style={{ color: "var(--w2k-red)" }}>✕</span>
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w2k-btn${active ? " active" : ""}`}
      style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 3, padding: "1px 6px", minHeight: 18 }}
      disabled={!onClick}
    >
      {indicator}
      {label}
    </button>
  );
}

function ValueBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ marginBottom: 2, fontSize: 10, fontWeight: "bold", color: "var(--w2k-gray-text)", fontFamily: '"MS Sans Serif", Tahoma, Arial, sans-serif' }}>{label}</div>
      <div
        className="w2k-sunken"
        style={{
          padding: "3px 5px",
          fontFamily: "Consolas, Courier New, monospace",
          fontSize: 11,
          whiteSpace: "pre-wrap",
          background: "#ffffff",
          color: "var(--w2k-black)",
        }}
      >
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
    accepted ? "var(--w2k-green)"
    : isError ? "var(--w2k-red)"
    : "var(--w2k-yellow)";

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
        overflow: "hidden",
      }}
      onPointerDown={(e) => onPointerDown(e, node)}
    >
      {/* Title bar */}
      <div className="w2k-titlebar" style={{ justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10 }}>📊</span>
          <span>Test Results</span>
        </div>
        {statusLabel && (
          <span style={{ fontSize: 10, fontWeight: "normal", color: statusColor === "var(--w2k-yellow)" ? "#ffdd44" : "#ffffff", background: statusColor === "var(--w2k-yellow)" ? "transparent" : statusColor, padding: "0 4px" }}>
            {statusLabel}
          </span>
        )}
      </div>

      {/* Mode tabs — Win2000 tab strip style */}
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "4px 6px 0 6px",
          background: "var(--w2k-btn-face)",
          borderBottom: "1px solid var(--w2k-btn-shadow)",
          flexShrink: 0,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={`w2k-btn${data.mode === "testcase" ? " active" : ""}`}
          style={{ fontSize: 11, minHeight: 20 }}
          onClick={() => updateResultsData(node, onUpdate, { mode: "testcase" })}
        >
          Testcase
        </button>
        <button
          type="button"
          className={`w2k-btn${data.mode === "result" ? " active" : ""}`}
          style={{ fontSize: 11, minHeight: 20 }}
          onClick={() => updateResultsData(node, onUpdate, { mode: "result" })}
        >
          Test Result
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "6px 6px",
          background: "var(--w2k-btn-face)",
          minHeight: 0,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Case tabs */}
        {hasCases && (
          <div style={{ marginBottom: 8, maxHeight: 52, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 3 }}>
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
              <p style={{ fontSize: 11, color: "var(--w2k-gray-text)", fontFamily: '"MS Sans Serif", Tahoma, Arial, sans-serif' }}>
                Run to see test cases.
              </p>
            )}
            {selected && <ValueBlock label="Input" value={selected.input} />}
          </>
        )}

        {/* Result mode - running */}
        {data.mode === "result" && running && (
          <p style={{ fontSize: 11, color: "var(--w2k-gray-text)", fontFamily: '"MS Sans Serif", Tahoma, Arial, sans-serif' }}>
            Running...
          </p>
        )}

        {/* Result mode - done */}
        {data.mode === "result" && !running && (
          <>
            {isError && data.errorMessage && (
              <div
                className="w2k-sunken"
                style={{
                  marginBottom: 8,
                  whiteSpace: "pre-wrap",
                  padding: "4px 6px",
                  fontFamily: "Consolas, Courier New, monospace",
                  fontSize: 11,
                  color: "var(--w2k-red)",
                  background: "#fff0f0",
                }}
              >
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
                    className="w2k-btn"
                    style={{ fontSize: 10 }}
                    onClick={() => updateResultsData(node, onUpdate, { mode: "testcase" })}
                  >
                    Open Testcase ↗
                  </button>
                )}
              </>
            )}

            {!hasCases && !running && (
              <p style={{ fontSize: 11, color: "var(--w2k-gray-text)", fontFamily: '"MS Sans Serif", Tahoma, Arial, sans-serif' }}>
                No results yet.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

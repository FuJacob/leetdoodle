import { TOOL_CONTROL_OPTIONS } from "./ui/controlOptions";

interface Props {
  tool: "select" | "draw";
  onToolChange: (tool: "select" | "draw") => void;
  thickness: number;
  onThicknessChange: (v: number) => void;
}

export function ToolPanel({ tool, onToolChange, thickness, onThicknessChange }: Props) {
  return (
    <div className="w2k-window" style={{ minWidth: 140 }}>
      <div className="w2k-titlebar">
        <span style={{ fontSize: 10 }}>🖱</span>
        <span>Tools</span>
      </div>
      <div style={{ padding: "6px 6px 6px 6px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", gap: 3 }}>
          {TOOL_CONTROL_OPTIONS.map(({ tool: optionTool, label }) => (
            <button
              key={optionTool}
              type="button"
              onClick={() => onToolChange(optionTool)}
              className={`w2k-btn${tool === optionTool ? " active" : ""}`}
              style={{ flex: 1 }}
            >
              {label}
            </button>
          ))}
        </div>
        {tool === "draw" && (
          <div style={{ marginTop: 4 }}>
            <div className="w2k-label" style={{ fontSize: 10, marginBottom: 2 }}>
              Thickness: {thickness}
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={thickness}
              style={{ width: "100%" }}
              onChange={(e) => onThicknessChange(Number(e.target.value))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

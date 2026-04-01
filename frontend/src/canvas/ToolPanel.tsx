import { TOOL_CONTROL_OPTIONS } from "./ui/controlOptions";

interface Props {
  tool: "select" | "draw";
  onToolChange: (tool: "select" | "draw") => void;
  thickness: number;
  onThicknessChange: (v: number) => void;
}

export function ToolPanel({ tool, onToolChange, thickness, onThicknessChange }: Props) {
  return (
    <div className="flex flex-col gap-2 border border-(--lc-border-default) bg-(--lc-surface-1) p-3">
      <div className="text-xs font-semibold text-(--lc-text-secondary)">Tool</div>
      <div className="flex gap-1">
        {TOOL_CONTROL_OPTIONS.map(({ tool: optionTool, label, Icon }) => (
          <button
            key={optionTool}
            type="button"
            onClick={() => onToolChange(optionTool)}
            className={`flex items-center gap-2 border px-3 py-1.5 text-sm transition ${
              tool === optionTool
                ? "border-(--lc-border-focus) bg-(--lc-surface-3) text-(--lc-accent)"
                : "border-(--lc-border-default) text-(--lc-text-secondary) hover:border-(--lc-border-focus) hover:text-(--lc-accent)"
            }`}
          >
            <Icon size={15} stroke={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      {tool === "draw" && (
        <div className="flex flex-col gap-1">
          <div className="text-[10px] text-(--lc-text-muted)">Thickness: {thickness}</div>
          <input
            type="range"
            min={1}
            max={10}
            value={thickness}
            className="w-full"
            onChange={(e) => onThicknessChange(Number(e.target.value))}
          />
        </div>
      )}
    </div>
  );
}

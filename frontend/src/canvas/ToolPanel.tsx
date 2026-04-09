import {
  CONTROL_ICON_SIZE,
  CONTROL_ICON_STROKE,
  TOOL_CONTROL_OPTIONS,
} from "./ui/controlOptions";
import {
  BUTTON_ACTIVE_CLASS,
  BUTTON_CLASS,
  MICRO_LABEL_CLASS,
  SURFACE_INSET_CLASS,
} from "../shared/ui/styles";

interface Props {
  tool: "select" | "draw";
  onToolChange: (tool: "select" | "draw") => void;
  thickness: number;
  onThicknessChange: (v: number) => void;
}

export function ToolPanel({ tool, onToolChange, thickness, onThicknessChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {TOOL_CONTROL_OPTIONS.map(({ tool: optionTool, label, Icon }) => (
          <button
            key={optionTool}
            type="button"
            onClick={() => onToolChange(optionTool)}
            className={`${BUTTON_CLASS} ${
              tool === optionTool
                ? BUTTON_ACTIVE_CLASS
                : ""
            }`}
          >
            <Icon size={CONTROL_ICON_SIZE} stroke={CONTROL_ICON_STROKE} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      {tool === "draw" && (
        <div className={`flex items-center gap-2 px-3 py-1.5 ${SURFACE_INSET_CLASS}`}>
          <span className={MICRO_LABEL_CLASS}>Thickness</span>
          <span className="min-w-5 text-xs text-(--lc-text-secondary)">{thickness}</span>
          <input
            type="range"
            min={1}
            max={10}
            value={thickness}
            className="w-24 accent-(--lc-accent)"
            onChange={(e) => onThicknessChange(Number(e.target.value))}
          />
        </div>
      )}
    </div>
  );
}

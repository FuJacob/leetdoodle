interface Props {
  tool: "select" | "draw";
  onToolChange: (tool: "select" | "draw") => void;
  thickness: number;
  onThicknessChange: (v: number) => void;
}

export function ToolPanel({ tool, onToolChange, thickness, onThicknessChange }: Props) {
  return (
    <div className="flex flex-col gap-2 border border-zinc-700 bg-zinc-900 p-3">
      <div className="text-xs font-semibold text-zinc-400">Tool</div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onToolChange("select")}
          className={`border px-3 py-1.5 text-sm ${
            tool === "select"
              ? "border-zinc-400 text-zinc-100"
              : "border-zinc-700 text-zinc-400"
          }`}
        >
          Select
        </button>
        <button
          type="button"
          onClick={() => onToolChange("draw")}
          className={`border px-3 py-1.5 text-sm ${
            tool === "draw"
              ? "border-zinc-400 text-zinc-100"
              : "border-zinc-700 text-zinc-400"
          }`}
        >
          Draw
        </button>
      </div>
      {tool === "draw" && (
        <div className="flex flex-col gap-1">
          <div className="text-[10px] text-zinc-500">Thickness: {thickness}</div>
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

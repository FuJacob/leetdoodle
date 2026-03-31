import { useState } from "react";
import type { NodeType } from "../shared/nodes";

interface SpawnPanelProps {
  onSpawn: (type: NodeType) => void;
}

const NODE_OPTIONS: { type: NodeType; label: string }[] = [
  { type: "note", label: "Note" },
  { type: "problem", label: "Problem" },
  { type: "code", label: "Code" },
];

export function SpawnPanel({ onSpawn }: SpawnPanelProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  async function handleShareCanvas() {
    const link = window.location.href;

    try {
      await navigator.clipboard.writeText(link);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }

    window.setTimeout(() => {
      setCopyState("idle");
    }, 1200);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-2 border border-zinc-700 bg-zinc-900 p-3">
        <div className="text-xs font-semibold text-zinc-400">Add node</div>
        {NODE_OPTIONS.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => onSpawn(type)}
            className="border border-zinc-700 px-3 py-2 text-left text-sm text-zinc-200"
          >
            {label}
          </button>
        ))}
      </div>

      <button
        onClick={handleShareCanvas}
        className="mt-1 border border-zinc-700 px-3 py-2 text-left text-sm text-zinc-200"
      >
        Share Canvas
      </button>
      <div className="text-[10px] text-zinc-500">
        {copyState === "copied" && "Link copied"}
        {copyState === "failed" && "Clipboard blocked"}
        {copyState === "idle" && "Copy join link"}
      </div>
    </div>
  );
}

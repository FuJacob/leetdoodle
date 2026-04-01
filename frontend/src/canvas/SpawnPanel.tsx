import { useState } from "react";
import { IconShare3 } from "@tabler/icons-react";
import type { NodeType } from "../shared/nodes";
import { NODE_CONTROL_OPTIONS } from "./ui/controlOptions";

interface SpawnPanelProps {
  onSpawn: (type: NodeType) => void;
}

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
        {NODE_CONTROL_OPTIONS.map(({ type, label, Icon }) => (
          <button
            key={type}
            onClick={() => onSpawn(type)}
            className="flex items-center gap-2 border border-zinc-700 px-3 py-2 text-left text-sm text-zinc-200 transition hover:border-blue-500 hover:text-blue-400"
          >
            <Icon size={16} stroke={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={handleShareCanvas}
        className="mt-1 flex items-center gap-2 border border-zinc-700 px-3 py-2 text-left text-sm text-zinc-200 transition hover:border-blue-500 hover:text-blue-400"
      >
        <IconShare3 size={16} stroke={1.8} />
        <span>Share Canvas</span>
      </button>
      <div className="text-[10px] text-zinc-500">
        {copyState === "copied" && "Link copied"}
        {copyState === "failed" && "Clipboard blocked"}
        {copyState === "idle" && "Copy join link"}
      </div>
    </div>
  );
}

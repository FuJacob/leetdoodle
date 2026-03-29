import { useState } from "react";
import type { NodeType } from "../shared/nodes";

interface SpawnPanelProps {
  onSpawn: (type: NodeType) => void;
  users: string[];
  localUserId: string;
}

const NODE_OPTIONS: { type: NodeType; label: string }[] = [
  { type: "note", label: "Note" },
  { type: "problem", label: "Problem" },
  { type: "code", label: "Code" },
];

const PRESENCE_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-red-500",
  "bg-cyan-500",
  "bg-orange-500",
];

function getPresenceColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

export function SpawnPanel({ onSpawn, users, localUserId }: SpawnPanelProps) {
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
    <div className="absolute right-4 top-4 z-10 flex items-start gap-3">
      <div className="flex items-center gap-5 border border-zinc-700 bg-zinc-900 p-2">
        {users.map((id) => (
          <div className="flex items-center gap-2">
            <div
              key={id}
              title={id === localUserId ? "You" : id}
              className={`h-3 w-3 rounded-full ${getPresenceColor(id)} ${id === localUserId ? "ring-1 ring-zinc-300" : ""}`}
            />
            <p className="text-white">{id.slice(0, 5)}</p>
          </div>
        ))}
      </div>
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
    </div>
  );
}

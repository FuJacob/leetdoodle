import { useState } from "react";
import type { NodeType } from "../shared/nodes";
import { NODE_CONTROL_OPTIONS } from "./ui/controlOptions";

interface SpawnPanelProps {
  onSpawn: (type: NodeType) => void;
}

export function SpawnPanel({ onSpawn }: SpawnPanelProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function handleShareCanvas() {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 1200);
  }

  return (
    <div className="w2k-window" style={{ minWidth: 130 }}>
      <div className="w2k-titlebar">
        <span style={{ fontSize: 10 }}>📋</span>
        <span>Add Node</span>
      </div>
      <div style={{ padding: "6px", display: "flex", flexDirection: "column", gap: 3 }}>
        {NODE_CONTROL_OPTIONS.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => onSpawn(type)}
            className="w2k-btn"
            style={{ textAlign: "left", width: "100%" }}
          >
            {label}
          </button>
        ))}
        <hr className="w2k-separator" />
        <button
          onClick={handleShareCanvas}
          className="w2k-btn"
          style={{ textAlign: "left", width: "100%" }}
        >
          Share Canvas...
        </button>
        <div
          style={{
            fontSize: 10,
            color: "var(--w2k-gray-text)",
            fontFamily: '"MS Sans Serif", Tahoma, Arial, sans-serif',
            minHeight: 14,
          }}
        >
          {copyState === "copied" && "✓ Link copied to clipboard"}
          {copyState === "failed" && "✗ Clipboard blocked"}
          {copyState === "idle" && "\u00a0"}
        </div>
      </div>
    </div>
  );
}

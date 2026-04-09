import { useEffect, useState } from "react";
import { IconUserPlus } from "@tabler/icons-react";
import { CanvasPresenceBar } from "./CanvasPresenceBar";
import { SpawnPanel } from "./SpawnPanel";
import { ThemePanel } from "./ThemePanel";
import { ToolPanel } from "./ToolPanel";
import { ZoomPanel } from "./ZoomPanel";
import { SessionTreeDock } from "./SessionTreeDock";
import type { NodeType } from "../shared/nodes";
import type { CollabUser } from "./presence/types";
import type { CanvasTool } from "./tools/types";
import { CONTROL_ICON_SIZE, CONTROL_ICON_STROKE } from "./ui/controlOptions";
import { BUTTON_CLASS } from "../shared/ui/styles";

interface CanvasChromeProps {
  users: CollabUser[];
  localUserId: string;
  tool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  thickness: number;
  onThicknessChange: (value: number) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSpawn: (type: NodeType) => void;
}

type ButtonState = "idle" | "done" | "failed";

function useTransientButtonState(durationMs = 1200) {
  const [state, setState] = useState<ButtonState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timeoutId = window.setTimeout(() => setState("idle"), durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [durationMs, state]);

  return { state, setState };
}

export function CanvasChrome({
  users,
  localUserId,
  tool,
  onToolChange,
  thickness,
  onThicknessChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onSpawn,
}: CanvasChromeProps) {
  const inviteState = useTransientButtonState();

  async function handleInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      inviteState.setState("done");
    } catch {
      inviteState.setState("failed");
    }
  }

  const inviteLabel =
    inviteState.state === "done"
      ? "Copied"
      : inviteState.state === "failed"
        ? "Failed"
        : "Invite";

  return (
    <div className="pointer-events-none absolute inset-0 z-80">
      <div
        className="pointer-events-auto absolute inset-x-0 top-0 flex h-14 items-center justify-between border-b border-(--lc-border-default) bg-(--lc-surface-1) px-4"
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="select-none text-sm font-semibold tracking-[0.04em] text-(--lc-text-primary)">
            Leetdoodle
          </div>
          <div className="h-6 w-px shrink-0 bg-(--lc-border-default)" />
          <ToolPanel
            tool={tool}
            onToolChange={onToolChange}
            thickness={thickness}
            onThicknessChange={onThicknessChange}
          />
        </div>

        <div className="flex items-center gap-4">
          <button type="button" className={BUTTON_CLASS} onClick={handleInvite}>
            <IconUserPlus
              size={CONTROL_ICON_SIZE}
              stroke={CONTROL_ICON_STROKE}
            />
            <span>{inviteLabel}</span>
          </button>

          <CanvasPresenceBar users={users} localUserId={localUserId} />

          <ZoomPanel
            zoom={zoom}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
          />

          <ThemePanel />
        </div>
      </div>

      <SpawnPanel onSpawn={onSpawn} />
      <SessionTreeDock />
    </div>
  );
}

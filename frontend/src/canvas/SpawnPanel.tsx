import { useEffect, useMemo, useRef, useState } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import type { NodeType } from "../shared/nodes";
import {
  CONTROL_ICON_SIZE,
  CONTROL_ICON_STROKE,
  NODE_CONTROL_OPTIONS,
} from "./ui/controlOptions";
import {
  ACTION_TRAY_CLASS,
  BUTTON_CLASS,
  ICON_BUTTON_CLASS,
} from "../shared/ui/styles";

interface SpawnPanelProps {
  onSpawn: (type: NodeType) => void;
}

export function SpawnPanel({ onSpawn }: SpawnPanelProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const orderedOptions = useMemo(() => {
    const order = ["problem", "code", "note"] as const;
    return order
      .map((type) => NODE_CONTROL_OPTIONS.find((option) => option.type === type))
      .filter((option): option is (typeof NODE_CONTROL_OPTIONS)[number] => option !== undefined);
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto absolute bottom-4 right-4 z-80 flex flex-col items-end gap-2"
    >
      {open && (
        <div className={`flex flex-col gap-1 ${ACTION_TRAY_CLASS}`}>
          {orderedOptions.map(({ type, label, Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onSpawn(type);
                setOpen(false);
              }}
              className={`${BUTTON_CLASS} justify-start`}
            >
              <Icon size={CONTROL_ICON_SIZE} stroke={CONTROL_ICON_STROKE} />
              <span>{label}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className={`${BUTTON_CLASS} justify-start`}
          >
            <IconX size={CONTROL_ICON_SIZE} stroke={CONTROL_ICON_STROKE} />
            <span>Close</span>
          </button>
        </div>
      )}

      <button
        type="button"
        aria-label={open ? "Close add node menu" : "Open add node menu"}
        onClick={() => setOpen((current) => !current)}
        className={ICON_BUTTON_CLASS}
      >
        <IconPlus size={CONTROL_ICON_SIZE} stroke={CONTROL_ICON_STROKE} />
      </button>
    </div>
  );
}

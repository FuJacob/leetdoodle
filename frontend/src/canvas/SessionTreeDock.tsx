import { useEffect, useRef, useState } from "react";
import { IconBinaryTree2 } from "@tabler/icons-react";
import { CONTROL_ICON_SIZE, CONTROL_ICON_STROKE } from "./ui/controlOptions";
import {
  BUTTON_CLASS,
  MICRO_LABEL_CLASS,
  SURFACE_SHELL_CLASS,
} from "../shared/ui/styles";

/**
 * Placeholder dock for the future session tree.
 *
 * The panel intentionally stays blank for now so the layout contract exists
 * before the tree data model is implemented.
 */
export function SessionTreeDock() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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
      className="pointer-events-auto absolute bottom-4 left-4 z-80 flex flex-col items-start gap-2"
    >
      {open && (
        <div className={`flex h-[22rem] w-72 flex-col overflow-hidden ${SURFACE_SHELL_CLASS}`}>
          <div className="border-b border-(--lc-border-default) px-3 py-2">
            <div className={MICRO_LABEL_CLASS}>Session Tree</div>
          </div>
          <div className="m-3 flex-1 rounded-md border border-dashed border-(--lc-border-default) bg-(--lc-surface-2)" />
        </div>
      )}

      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={() => setOpen((current) => !current)}
      >
        <IconBinaryTree2
          size={CONTROL_ICON_SIZE}
          stroke={CONTROL_ICON_STROKE}
        />
        <span>Session</span>
      </button>
    </div>
  );
}

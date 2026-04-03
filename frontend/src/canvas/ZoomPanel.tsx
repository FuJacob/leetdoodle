import { IconMinus, IconPlus } from "@tabler/icons-react";
import { CONTROL_ICON_SIZE, CONTROL_ICON_STROKE } from "./ui/controlOptions";

interface ZoomPanelProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ZoomPanel({ zoom, onZoomIn, onZoomOut }: ZoomPanelProps) {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="flex flex-col gap-2 border border-(--lc-border-default) bg-(--lc-surface-1) p-3">
      <div className="text-xs font-semibold text-(--lc-text-secondary)">Zoom</div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={onZoomOut}
          className="flex h-9 w-9 items-center justify-center border border-(--lc-border-default) bg-(--lc-surface-2) text-(--lc-text-secondary) transition hover:border-(--lc-border-focus) hover:text-(--lc-accent)"
        >
          <IconMinus size={CONTROL_ICON_SIZE} stroke={CONTROL_ICON_STROKE} />
        </button>
        <div className="min-w-14 border border-(--lc-border-default) bg-(--lc-surface-2) px-2 py-1.5 text-center text-sm font-medium text-(--lc-text-primary)">
          {zoomPercent}%
        </div>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={onZoomIn}
          className="flex h-9 w-9 items-center justify-center border border-(--lc-border-default) bg-(--lc-surface-2) text-(--lc-text-secondary) transition hover:border-(--lc-border-focus) hover:text-(--lc-accent)"
        >
          <IconPlus size={CONTROL_ICON_SIZE} stroke={CONTROL_ICON_STROKE} />
        </button>
      </div>
    </div>
  );
}

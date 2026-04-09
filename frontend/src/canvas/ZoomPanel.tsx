import { IconMinus, IconPlus } from "@tabler/icons-react";
import { CONTROL_ICON_SIZE, CONTROL_ICON_STROKE } from "./ui/controlOptions";
import {
  ICON_BUTTON_CLASS,
  MICRO_LABEL_CLASS,
  SURFACE_INSET_CLASS,
} from "../shared/ui/styles";

interface ZoomPanelProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ZoomPanel({ zoom, onZoomIn, onZoomOut }: ZoomPanelProps) {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="flex items-center gap-2">
      <span className={MICRO_LABEL_CLASS}>Zoom</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={onZoomOut}
          className={ICON_BUTTON_CLASS}
        >
          <IconMinus size={CONTROL_ICON_SIZE} stroke={CONTROL_ICON_STROKE} />
        </button>
        <div
          className={`min-w-14 px-2 py-1.5 text-center text-sm font-medium text-(--lc-text-primary) ${SURFACE_INSET_CLASS}`}
        >
          {zoomPercent}%
        </div>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={onZoomIn}
          className={ICON_BUTTON_CLASS}
        >
          <IconPlus size={CONTROL_ICON_SIZE} stroke={CONTROL_ICON_STROKE} />
        </button>
      </div>
    </div>
  );
}

import { useCallback, useRef, useState } from "react";
import type { LocalCursorMode } from "../types";

interface UseSpacePanControllerArgs {
  cancelPan: () => void;
  panPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  panPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  panPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  panPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  collabPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onLocalCursorModeChange: (mode: LocalCursorMode) => void;
}

/**
 * Manages the temporary "hold space to pan" interaction mode.
 *
 * It keeps keyboard-driven pan state in sync with pointer-driven pan handlers
 * and exposes the overlay event callbacks used by the canvas view.
 */
export function useSpacePanController({
  cancelPan,
  panPointerDown,
  panPointerMove,
  panPointerUp,
  panPointerCancel,
  collabPointerMove,
  onLocalCursorModeChange,
}: UseSpacePanControllerArgs) {
  const [isSpacePanning, setIsSpacePanning] = useState(false);
  const isSpacePanningRef = useRef(false);

  const beginSpacePan = useCallback(() => {
    if (isSpacePanningRef.current) return;
    isSpacePanningRef.current = true;
    onLocalCursorModeChange("grab");
    setIsSpacePanning(true);
  }, [onLocalCursorModeChange]);

  const endSpacePan = useCallback(() => {
    if (!isSpacePanningRef.current) return;
    isSpacePanningRef.current = false;
    cancelPan();
    onLocalCursorModeChange("pointer");
    setIsSpacePanning(false);
  }, [cancelPan, onLocalCursorModeChange]);

  const onSpacePanPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      panPointerDown(event);
      onLocalCursorModeChange("grabbing");
    },
    [onLocalCursorModeChange, panPointerDown],
  );

  const onSpacePanPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      panPointerMove(event);
      collabPointerMove(event);
    },
    [collabPointerMove, panPointerMove],
  );

  const onSpacePanPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      onLocalCursorModeChange("grab");
      panPointerUp(event);
    },
    [onLocalCursorModeChange, panPointerUp],
  );

  const onSpacePanPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      onLocalCursorModeChange("grab");
      panPointerCancel(event);
    },
    [onLocalCursorModeChange, panPointerCancel],
  );

  return {
    isSpacePanning,
    beginSpacePan,
    endSpacePan,
    onSpacePanPointerDown,
    onSpacePanPointerMove,
    onSpacePanPointerUp,
    onSpacePanPointerCancel,
  };
}

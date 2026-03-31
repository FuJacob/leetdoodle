import { useEffect, useRef } from "react";

const DEFAULT_EPSILON_PX = 0.5;

export interface UseNodeContentSizeSyncOptions {
  enabled: boolean;
  nodeId: string;
  ref: React.RefObject<HTMLElement | null>;
  currentWidth: number;
  currentHeight: number;
  minWidth: number;
  minHeight: number;
  onSizeChange: (nodeId: string, width: number, height: number) => void;
  epsilonPx?: number;
}

/**
 * Keeps canvas-node dimensions in sync with rendered DOM size.
 *
 * Uses offsetWidth/offsetHeight so measurements remain stable under CSS transforms
 * (e.g. canvas zoom scale), then emits only when dimensions changed materially.
 */
export function useNodeContentSizeSync({
  enabled,
  nodeId,
  ref,
  currentWidth,
  currentHeight,
  minWidth,
  minHeight,
  onSizeChange,
  epsilonPx = DEFAULT_EPSILON_PX,
}: UseNodeContentSizeSyncOptions) {
  const latestRef = useRef({
    nodeId,
    width: currentWidth,
    height: currentHeight,
  });

  useEffect(() => {
    latestRef.current = {
      nodeId,
      width: currentWidth,
      height: currentHeight,
    };
  }, [nodeId, currentWidth, currentHeight]);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    let rafId: number | null = null;

    const syncMeasuredSize = () => {
      rafId = null;

      const measuredWidth = Math.max(minWidth, el.offsetWidth);
      const measuredHeight = Math.max(minHeight, el.offsetHeight);
      const latest = latestRef.current;

      const widthUnchanged =
        Math.abs(measuredWidth - latest.width) < epsilonPx;
      const heightUnchanged =
        Math.abs(measuredHeight - latest.height) < epsilonPx;
      if (widthUnchanged && heightUnchanged) {
        return;
      }

      onSizeChange(latest.nodeId, measuredWidth, measuredHeight);
    };

    const scheduleSync = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(syncMeasuredSize);
    };

    // Reconcile stale persisted dimensions on mount.
    scheduleSync();

    const resizeObserver = new ResizeObserver(() => {
      scheduleSync();
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [enabled, ref, minWidth, minHeight, onSizeChange, epsilonPx]);
}

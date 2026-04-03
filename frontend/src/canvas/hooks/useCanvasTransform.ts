import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Transform } from "../types";
import { zoomToward } from "../utils/math";

const INITIAL_TRANSFORM: Transform = { x: 0, y: 0, zoom: 1 };

interface PanState {
  active: boolean;
  startX: number;
  startY: number;
  startTransformX: number;
  startTransformY: number;
  pointerId: number | null;
  target: HTMLDivElement | null;
}

export function useCanvasTransform(
  viewportRef: React.RefObject<HTMLDivElement | null>,
) {
  const [transform, setTransform] = useState<Transform>(INITIAL_TRANSFORM);

  // Mirror transform in a ref so event handlers can read current value
  // without depending on state (avoids stale closures and unnecessary re-renders).
  // useLayoutEffect fires synchronously after commit — ref is current before
  // any pointer events can fire, with no concurrent-mode side effects.
  const transformRef = useRef<Transform>(INITIAL_TRANSFORM);
  useLayoutEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const panRef = useRef<PanState>({
    active: false,
    startX: 0,
    startY: 0,
    startTransformX: 0,
    startTransformY: 0,
    pointerId: null,
    target: null,
  });

  const resetPan = useCallback((releaseCapture: boolean) => {
    const { target, pointerId } = panRef.current;

    if (
      releaseCapture &&
      target &&
      pointerId !== null &&
      target.hasPointerCapture(pointerId)
    ) {
      target.releasePointerCapture(pointerId);
    }

    panRef.current = {
      active: false,
      startX: 0,
      startY: 0,
      startTransformX: 0,
      startTransformY: 0,
      pointerId: null,
      target: null,
    };
  }, []);

  // Non-passive wheel listener — must be attached via addEventListener to allow preventDefault.
  // React 19 attaches onWheel as passive, which silently ignores e.preventDefault().
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      setTransform((prev) => zoomToward(prev, screenX, screenY, e.deltaY));
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [viewportRef]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only pan when clicking the viewport itself, not nodes (nodes call stopPropagation).
    if (e.target !== e.currentTarget) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    panRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startTransformX: transformRef.current.x,
      startTransformY: transformRef.current.y,
      pointerId: e.pointerId,
      target: e.currentTarget,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current.active) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    setTransform((prev) => ({
      ...prev,
      x: panRef.current.startTransformX + dx,
      y: panRef.current.startTransformY + dy,
    }));
  }, []);

  const onPointerUp = useCallback(() => {
    // Guard: only release capture if this pointer was captured for panning.
    // Calling releasePointerCapture on an uncaptured pointer throws a DOMException.
    if (!panRef.current.active) return;
    resetPan(true);
  }, [resetPan]);

  return {
    transform,
    transformRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    cancelPan: () => resetPan(true),
  };
}

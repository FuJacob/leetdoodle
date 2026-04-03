import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Transform } from "../types";
import { ZOOM_STEP_FACTOR, zoomByFactorToward } from "../utils/math";

const INITIAL_TRANSFORM: Transform = { x: 0, y: 0, zoom: 1 };
const PAN_SELECTION_CLASS = "lc-is-panning";
const PAN_LIMIT_PX = 4800;

interface PanState {
  active: boolean;
  startX: number;
  startY: number;
  startTransformX: number;
  startTransformY: number;
  pointerId: number | null;
  target: HTMLDivElement | null;
}

function clampPan(value: number): number {
  return Math.min(PAN_LIMIT_PX, Math.max(-PAN_LIMIT_PX, value));
}

function clampTransformPan(transform: Transform): Transform {
  return {
    ...transform,
    x: clampPan(transform.x),
    y: clampPan(transform.y),
  };
}

function normalizeWheelDelta(delta: number, deltaMode: number, pageSize: number): number {
  switch (deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return delta * 16;
    case WheelEvent.DOM_DELTA_PAGE:
      return delta * pageSize;
    default:
      return delta;
  }
}

function canScrollInDirection(
  element: HTMLElement,
  deltaX: number,
  deltaY: number,
): boolean {
  const style = window.getComputedStyle(element);
  const canScrollX =
    /(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
  const canScrollY =
    /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;

  const canMoveLeft = element.scrollLeft > 0;
  const canMoveRight =
    element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
  const canMoveUp = element.scrollTop > 0;
  const canMoveDown =
    element.scrollTop + element.clientHeight < element.scrollHeight - 1;

  if (deltaX < 0 && canScrollX && canMoveLeft) return true;
  if (deltaX > 0 && canScrollX && canMoveRight) return true;
  if (deltaY < 0 && canScrollY && canMoveUp) return true;
  if (deltaY > 0 && canScrollY && canMoveDown) return true;
  return false;
}

function shouldAllowNativeWheel(
  target: EventTarget | null,
  viewport: HTMLDivElement,
  deltaX: number,
  deltaY: number,
): boolean {
  let current =
    target instanceof HTMLElement ? target : target instanceof Node ? target.parentElement : null;

  while (current && current !== viewport) {
    if (canScrollInDirection(current, deltaX, deltaY)) {
      return true;
    }
    current = current.parentElement;
  }

  return false;
}

/**
 * Owns viewport pan and zoom state for the infinite canvas.
 *
 * The hook exposes pointer handlers for drag-panning, a non-passive wheel
 * panning listener, explicit zoom controls, and a live transform ref for
 * interaction code that must avoid stale closures.
 */
export function useCanvasTransform(
  viewportRef: React.RefObject<HTMLDivElement | null>,
) {
  const [transform, setTransform] = useState<Transform>(INITIAL_TRANSFORM);

  const setPanSelectionSuppressed = useCallback((active: boolean) => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle(PAN_SELECTION_CLASS, active);
  }, []);

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

  const getViewportCenter = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return null;
    }

    const rect = viewport.getBoundingClientRect();
    return {
      x: rect.width / 2,
      y: rect.height / 2,
    };
  }, [viewportRef]);

  const zoomByFactor = useCallback(
    (factor: number) => {
      const center = getViewportCenter();
      if (!center) return;

      setTransform((prev) =>
        clampTransformPan(
          zoomByFactorToward(prev, center.x, center.y, factor),
        ),
      );
    },
    [getViewportCenter],
  );

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

    setPanSelectionSuppressed(false);

    panRef.current = {
      active: false,
      startX: 0,
      startY: 0,
      startTransformX: 0,
      startTransformY: 0,
      pointerId: null,
      target: null,
    };
  }, [setPanSelectionSuppressed]);

  // Non-passive wheel listener — must be attached via addEventListener to allow preventDefault.
  // React 19 attaches onWheel as passive, which silently ignores e.preventDefault().
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const deltaX = normalizeWheelDelta(e.deltaX, e.deltaMode, el.clientWidth);
      const deltaY = normalizeWheelDelta(e.deltaY, e.deltaMode, el.clientHeight);
      if (shouldAllowNativeWheel(e.target, el, deltaX, deltaY)) {
        return;
      }

      e.preventDefault();

      setTransform((prev) =>
        clampTransformPan({
          ...prev,
          x: prev.x - deltaX,
          y: prev.y - deltaY,
        }),
      );
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [viewportRef]);

  useEffect(() => {
    return () => {
      resetPan(false);
    };
  }, [resetPan]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only pan when clicking the viewport itself, not nodes (nodes call stopPropagation).
    if (e.target !== e.currentTarget) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setPanSelectionSuppressed(true);
    panRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startTransformX: transformRef.current.x,
      startTransformY: transformRef.current.y,
      pointerId: e.pointerId,
      target: e.currentTarget,
    };
  }, [setPanSelectionSuppressed]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current.active) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    setTransform((prev) =>
      clampTransformPan({
        ...prev,
        x: panRef.current.startTransformX + dx,
        y: panRef.current.startTransformY + dy,
      }),
    );
  }, []);

  const onPointerUp = useCallback(() => {
    // Guard: only release capture if this pointer was captured for panning.
    // Calling releasePointerCapture on an uncaptured pointer throws a DOMException.
    if (!panRef.current.active) return;
    resetPan(true);
  }, [resetPan]);

  const onPointerCancel = useCallback(() => {
    if (!panRef.current.active) return;
    resetPan(true);
  }, [resetPan]);

  return {
    transform,
    transformRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    zoomIn: () => zoomByFactor(ZOOM_STEP_FACTOR),
    zoomOut: () => zoomByFactor(1 / ZOOM_STEP_FACTOR),
    cancelPan: () => resetPan(true),
  };
}

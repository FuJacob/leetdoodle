import { useCallback, useEffect, useRef } from "react";
import type { CanvasToolController } from "../../../canvas/tools/types";
import type { Transform } from "../../../canvas/types";
import { screenToWorld } from "../../../canvas/utils/coordinates";
import type { CanvasOutboundEvent } from "../../../shared/events";
import type { CanvasNode } from "../../../shared/nodes";

interface DrawToolControllerDeps {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  transformRef: React.RefObject<Transform>;
  send: (event: CanvasOutboundEvent) => void;
  collabPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  thickness: number;
  onCommitStroke: (points: Array<[number, number]>, thickness: number) => void;
}

export function useDrawToolController({
  viewportRef,
  transformRef,
  send,
  collabPointerMove,
  thickness,
  onCommitStroke,
}: DrawToolControllerDeps): CanvasToolController {
  const isDrawingRef = useRef(false);
  const allDrawPointsRef = useRef<Array<[number, number]>>([]);
  const pendingDrawPointsRef = useRef<Array<[number, number]>>([]);
  const lastDrawFlushRef = useRef(0);
  const localPolylineRef = useRef<SVGPolylineElement | null>(null);
  const thicknessRef = useRef(thickness);
  const activeStrokeThicknessRef = useRef(thickness);

  useEffect(() => {
    thicknessRef.current = thickness;
  }, [thickness]);

  const updateLocalPolyline = useCallback(() => {
    const el = localPolylineRef.current;
    if (!el) return;
    const t = transformRef.current;
    const pointsStr = allDrawPointsRef.current
      .map(([x, y]) => `${x * t.zoom + t.x},${y * t.zoom + t.y}`)
      .join(" ");
    el.setAttribute("points", pointsStr);
    el.setAttribute(
      "stroke-width",
      String(activeStrokeThicknessRef.current * t.zoom),
    );
  }, [transformRef]);

  const toWorldPoint = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): [number, number] | null => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const { x, y } = screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top,
        transformRef.current,
      );
      return [x, y];
    },
    [viewportRef, transformRef],
  );

  const handleDrawPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      allDrawPointsRef.current = [];
      pendingDrawPointsRef.current = [];
      activeStrokeThicknessRef.current = thicknessRef.current;

      const pt = toWorldPoint(e);
      if (!pt) return;
      allDrawPointsRef.current.push(pt);
      pendingDrawPointsRef.current.push(pt);
      updateLocalPolyline();
    },
    [toWorldPoint, updateLocalPolyline],
  );

  const handleDrawPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      collabPointerMove(e);
      if (!isDrawingRef.current) return;

      const pt = toWorldPoint(e);
      if (!pt) return;
      allDrawPointsRef.current.push(pt);
      pendingDrawPointsRef.current.push(pt);
      updateLocalPolyline();

      const now = performance.now();
      if (
        now - lastDrawFlushRef.current >= 16 &&
        pendingDrawPointsRef.current.length > 0
      ) {
        lastDrawFlushRef.current = now;
        const batch = pendingDrawPointsRef.current.splice(0);
        send({
          type: "draw_points",
          points: batch,
          thickness: activeStrokeThicknessRef.current,
        });
      }
    },
    [collabPointerMove, toWorldPoint, updateLocalPolyline, send],
  );

  const handleDrawPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      if (pendingDrawPointsRef.current.length > 0) {
        const trailing = pendingDrawPointsRef.current.splice(0);
        send({
          type: "draw_points",
          points: trailing,
          thickness: activeStrokeThicknessRef.current,
        });
      }
      send({ type: "draw_end" });

      localPolylineRef.current?.setAttribute("points", "");

      const pts = allDrawPointsRef.current;
      if (pts.length < 2) return;
      onCommitStroke(pts, activeStrokeThicknessRef.current);
    },
    [onCommitStroke, send],
  );

  const onNodePointerDown = useCallback(
    (_e: React.PointerEvent<HTMLDivElement>, _node: CanvasNode) => {
      // Draw mode captures pointer at the canvas layer; node dragging is disabled.
    },
    [],
  );

  return {
    onCanvasPointerDown: () => {},
    onCanvasPointerMove: () => {},
    onCanvasPointerUp: () => {},
    onNodePointerDown,
    layers: (
      <>
        <svg
          className="pointer-events-none absolute inset-0 z-25"
          style={{ width: "100%", height: "100%" }}
        >
          <polyline
            ref={localPolylineRef}
            fill="none"
            stroke="white"
            strokeWidth={thickness * transformRef.current.zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div
          className="absolute inset-0 z-50 cursor-crosshair"
          onPointerDown={handleDrawPointerDown}
          onPointerMove={handleDrawPointerMove}
          onPointerUp={handleDrawPointerUp}
        />
      </>
    ),
  };
}

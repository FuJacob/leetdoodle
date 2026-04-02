import { useCallback, useRef, useState } from "react";
import type { CanvasNode } from "../../shared/nodes";
import type { Transform } from "../types";
import { screenToWorld } from "../utils/coordinates";
import type { CanvasToolController } from "./types";

interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectToolControllerDeps {
  selectNodes: (nodeIds: Set<string>) => void;
  dragPointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    node: CanvasNode,
  ) => void;
  dragPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  dragPointerUp: () => void;
  collabPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  transformRef: React.RefObject<Transform>;
  nodesRef: React.RefObject<CanvasNode[]>;
  selectedNodeIds: Set<string>;
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function normalizeRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): MarqueeRect {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
  };
}

export function useSelectToolController({
  selectNodes,
  dragPointerDown,
  dragPointerMove,
  dragPointerUp,
  collabPointerMove,
  viewportRef,
  transformRef,
  nodesRef,
  selectedNodeIds,
}: SelectToolControllerDeps): CanvasToolController {
  const marqueeRef = useRef<{
    active: boolean;
    anchorX: number; // world coords
    anchorY: number;
  } | null>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);

  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;

      selectNodes(new Set());

      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const world = screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top,
        transformRef.current,
      );
      marqueeRef.current = {
        active: true,
        anchorX: world.x,
        anchorY: world.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [selectNodes, viewportRef, transformRef],
  );

  const onCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      collabPointerMove(e);
      dragPointerMove(e);

      const m = marqueeRef.current;
      if (!m?.active) return;

      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const world = screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top,
        transformRef.current,
      );

      const selRect = normalizeRect(m.anchorX, m.anchorY, world.x, world.y);
      setMarquee(selRect);

      // Hit-test nodes against marquee
      const hit = new Set<string>();
      for (const node of nodesRef.current) {
        if (
          rectsOverlap(selRect, {
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
          })
        ) {
          hit.add(node.id);
        }
      }
      selectNodes(hit);
    },
    [collabPointerMove, dragPointerMove, viewportRef, transformRef, nodesRef, selectNodes],
  );

  const onCanvasPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (marqueeRef.current?.active) {
        marqueeRef.current = null;
        setMarquee(null);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }
      dragPointerUp();
    },
    [dragPointerUp],
  );

  const onNodePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => {
      // If clicking a node that's already in the multi-selection, keep selection and drag all.
      // If clicking an unselected node, make it the sole selection.
      if (!selectedNodeIds.has(node.id)) {
        selectNodes(new Set([node.id]));
      }
      dragPointerDown(e, node);
    },
    [selectNodes, selectedNodeIds, dragPointerDown],
  );

  const transform = transformRef.current;
  const layers = marquee ? (
    <div
      className="absolute inset-0 z-30 pointer-events-none"
    >
      <div
        className="absolute border border-(--lc-selection-local) bg-(--lc-selection-local)/10"
        style={{
          left: marquee.x * transform.zoom + transform.x,
          top: marquee.y * transform.zoom + transform.y,
          width: marquee.width * transform.zoom,
          height: marquee.height * transform.zoom,
        }}
      />
    </div>
  ) : null;

  return {
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onNodePointerDown,
    layers,
  };
}

import { useCallback, useRef } from "react";
import type { Transform } from "../types";
import type { CanvasNode } from "../../shared/nodes";

interface DragNodeSnapshot {
  id: string;
  startX: number;
  startY: number;
}

interface DragState {
  active: boolean;
  startScreenX: number;
  startScreenY: number;
  lastScreenX: number;
  lastScreenY: number;
  pointerId: number | null;
  pointerTarget: HTMLDivElement | null;
  nodes: DragNodeSnapshot[];
}

type MoveNodes = (moves: Array<{ id: string; x: number; y: number }>) => void;

interface ActiveNodeDrag {
  nodeIds: string[];
  dx: number;
  dy: number;
}

interface NodeDragCallbacks {
  onDragStart?: (nodeIds: string[]) => void;
  onDragUpdate?: (drag: ActiveNodeDrag) => void;
  onDragEnd?: () => void;
}

/**
 * Drives direct-manipulation dragging for one node or a multi-selection.
 *
 * It tracks pointer lifecycle, computes world-space deltas from the viewport
 * transform, applies movement through the provided command, and emits optional
 * drag lifecycle callbacks for visual or collaborative side effects.
 */
export function useNodeDrag(
  transformRef: React.RefObject<Transform>,
  moveNodes: MoveNodes,
  selectedNodeIds: Set<string>,
  nodesRef: React.RefObject<CanvasNode[]>,
  callbacks: NodeDragCallbacks = {},
) {
  const dragRef = useRef<DragState>({
    active: false,
    startScreenX: 0,
    startScreenY: 0,
    lastScreenX: 0,
    lastScreenY: 0,
    pointerId: null,
    pointerTarget: null,
    nodes: [],
  });

  // When a selected node is clicked, drag all selected nodes together.
  // When an unselected node is clicked, the controller updates selection first,
  // so we fall back to dragging just that one node.
  const onNodePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => {
      e.stopPropagation();

      const idsToMove = selectedNodeIds.has(node.id)
        ? selectedNodeIds
        : new Set([node.id]);

      const snapshots: DragNodeSnapshot[] = [];
      for (const n of nodesRef.current) {
        if (idsToMove.has(n.id)) {
          snapshots.push({ id: n.id, startX: n.x, startY: n.y });
        }
      }
      if (snapshots.length === 0) return;

      dragRef.current = {
        active: true,
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        lastScreenX: e.clientX,
        lastScreenY: e.clientY,
        pointerId: e.pointerId,
        pointerTarget: e.currentTarget,
        nodes: snapshots,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      callbacks.onDragStart?.(snapshots.map((snapshot) => snapshot.id));
    },
    [callbacks, selectedNodeIds, nodesRef],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active || drag.nodes.length === 0) return;

      const zoom = transformRef.current.zoom;
      const dx = (e.clientX - drag.startScreenX) / zoom;
      const dy = (e.clientY - drag.startScreenY) / zoom;
      const stepDx = (e.clientX - drag.lastScreenX) / zoom;
      const stepDy = (e.clientY - drag.lastScreenY) / zoom;

      moveNodes(
        drag.nodes.map((n) => ({
          id: n.id,
          x: n.startX + dx,
          y: n.startY + dy,
        })),
      );
      drag.lastScreenX = e.clientX;
      drag.lastScreenY = e.clientY;
      callbacks.onDragUpdate?.({
        nodeIds: drag.nodes.map((node) => node.id),
        dx: stepDx,
        dy: stepDy,
      });
    },
    [callbacks, transformRef, moveNodes],
  );

  const onPointerUp = useCallback(() => {
    if (!dragRef.current.active) return;
    const { pointerId, pointerTarget } = dragRef.current;
    if (
      pointerId != null &&
      pointerTarget != null &&
      pointerTarget.hasPointerCapture(pointerId)
    ) {
      pointerTarget.releasePointerCapture(pointerId);
    }
    dragRef.current.active = false;
    dragRef.current.nodes = [];
    dragRef.current.pointerId = null;
    dragRef.current.pointerTarget = null;
    callbacks.onDragEnd?.();
  }, [callbacks]);

  return { onNodePointerDown, onPointerMove, onPointerUp };
}

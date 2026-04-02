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
  nodes: DragNodeSnapshot[];
}

type MoveNodes = (moves: Array<{ id: string; x: number; y: number }>) => void;

export function useNodeDrag(
  transformRef: React.RefObject<Transform>,
  moveNodes: MoveNodes,
  selectedNodeIds: Set<string>,
  nodesRef: React.RefObject<CanvasNode[]>,
) {
  const dragRef = useRef<DragState>({
    active: false,
    startScreenX: 0,
    startScreenY: 0,
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

      dragRef.current = {
        active: true,
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        nodes: snapshots,
      };
    },
    [selectedNodeIds, nodesRef],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active || drag.nodes.length === 0) return;

      const zoom = transformRef.current.zoom;
      const dx = (e.clientX - drag.startScreenX) / zoom;
      const dy = (e.clientY - drag.startScreenY) / zoom;

      moveNodes(
        drag.nodes.map((n) => ({
          id: n.id,
          x: n.startX + dx,
          y: n.startY + dy,
        })),
      );
    },
    [transformRef, moveNodes],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
    dragRef.current.nodes = [];
  }, []);

  return { onNodePointerDown, onPointerMove, onPointerUp };
}

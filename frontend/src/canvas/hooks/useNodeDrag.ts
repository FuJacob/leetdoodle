import { useCallback, useRef } from 'react';
import type { Transform } from '../types';
import type { CanvasNode } from '../../shared/nodes';

interface DragState {
  active: boolean;
  startScreenX: number;
  startScreenY: number;
  startWorldX: number;
  startWorldY: number;
}

type UpdateNode = (id: string, patch: Partial<CanvasNode>) => void;

export function useNodeDrag(
  transformRef: React.RefObject<Transform>,
  updateNode: UpdateNode,
) {
  const dragRef = useRef<DragState>({
    active: false,
    startScreenX: 0,
    startScreenY: 0,
    startWorldX: 0,
    startWorldY: 0,
  });
  const draggingIdRef = useRef<string | null>(null);

  // Called by NodeRenderer's onPointerDown.
  const onNodePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => {
      e.stopPropagation(); // prevent viewport pan from activating
      // Do NOT call setPointerCapture here — move/up are handled at the viewport
      // level which covers the full screen. Capturing on the node div would route
      // events away from the viewport, defeating that design.
      draggingIdRef.current = node.id;
      dragRef.current = {
        active: true,
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        startWorldX: node.x,
        startWorldY: node.y,
      };
    },
    [],
  );

  // Called by the viewport's onPointerMove (alongside pan handler).
  // No-op when no node drag is active.
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current.active || !draggingIdRef.current) return;
      const zoom = transformRef.current.zoom;
      const dx = (e.clientX - dragRef.current.startScreenX) / zoom;
      const dy = (e.clientY - dragRef.current.startScreenY) / zoom;
      updateNode(draggingIdRef.current, {
        x: dragRef.current.startWorldX + dx,
        y: dragRef.current.startWorldY + dy,
      });
    },
    [transformRef, updateNode],
  );

  // Called by the viewport's onPointerUp (alongside pan handler).
  const onPointerUp = useCallback(
    (_e: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current.active = false;
      draggingIdRef.current = null;
    },
    [],
  );

  return { onNodePointerDown, onPointerMove, onPointerUp };
}

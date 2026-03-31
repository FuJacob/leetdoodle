import { useCallback } from "react";
import type { CanvasNode } from "../../shared/nodes";
import type { CanvasToolController } from "./types";

interface SelectToolControllerDeps {
  selectNode: (nodeId: string | null) => void;
  panPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  panPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  panPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  dragPointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    node: CanvasNode,
  ) => void;
  dragPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  dragPointerUp: () => void;
  collabPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function useSelectToolController({
  selectNode,
  panPointerDown,
  panPointerMove,
  panPointerUp,
  dragPointerDown,
  dragPointerMove,
  dragPointerUp,
  collabPointerMove,
}: SelectToolControllerDeps): CanvasToolController {
  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        selectNode(null);
      }
      panPointerDown(e);
    },
    [selectNode, panPointerDown],
  );

  const onCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      panPointerMove(e);
      dragPointerMove(e);
      collabPointerMove(e);
    },
    [panPointerMove, dragPointerMove, collabPointerMove],
  );

  const onCanvasPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      panPointerUp(e);
      dragPointerUp();
    },
    [panPointerUp, dragPointerUp],
  );

  const onNodePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => {
      selectNode(node.id);
      dragPointerDown(e, node);
    },
    [selectNode, dragPointerDown],
  );

  return {
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onNodePointerDown,
    layers: null,
  };
}

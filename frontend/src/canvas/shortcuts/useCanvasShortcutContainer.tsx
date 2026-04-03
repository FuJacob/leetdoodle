import { useCallback } from "react";
import type { CanvasNode } from "../../shared/nodes";
import type { LocalCursorMode } from "../types";
import type { CanvasTool } from "../tools/types";
import { useCanvasClipboard } from "./useCanvasClipboard";
import { useCanvasHotkeys } from "./useCanvasHotkeys";
import { useSpacePanController } from "./useSpacePanController";

interface UseCanvasShortcutContainerArgs {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  nodesRef: React.RefObject<CanvasNode[]>;
  selectedNodeIds: Set<string>;
  tool: CanvasTool;
  setTool: (tool: CanvasTool) => void;
  selectNodes: (nodeIds: Set<string>) => void;
  deleteNode: (nodeId: string) => void;
  cloneNode: (nodeId: string) => void;
  pasteNodeFromSnapshot: (sourceNode: CanvasNode) => void;
  panPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  panPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  panPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  panPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  cancelPan: () => void;
  collabPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onLocalCursorModeChange: (mode: LocalCursorMode) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

/**
 * Composes the canvas keyboard and space-pan subsystems into one UI-facing API.
 *
 * Canvas uses this hook as the single integration point for shortcut behavior,
 * while the actual responsibilities live in smaller focused hooks.
 */
export function useCanvasShortcutContainer({
  viewportRef,
  nodesRef,
  selectedNodeIds,
  tool,
  setTool,
  selectNodes,
  deleteNode,
  cloneNode,
  pasteNodeFromSnapshot,
  panPointerDown,
  panPointerMove,
  panPointerUp,
  panPointerCancel,
  cancelPan,
  collabPointerMove,
  onLocalCursorModeChange,
  zoomIn,
  zoomOut,
}: UseCanvasShortcutContainerArgs) {
  const clearSelection = useCallback(() => {
    selectNodes(new Set());
  }, [selectNodes]);

  const deleteSelection = useCallback(() => {
    if (selectedNodeIds.size === 0) return;
    for (const nodeId of selectedNodeIds) {
      deleteNode(nodeId);
    }
  }, [deleteNode, selectedNodeIds]);

  const {
    copySelection,
    duplicateSelection,
    pasteClipboard,
    canPaste,
  } = useCanvasClipboard({
    nodesRef,
    selectedNodeIds,
    cloneNode,
    pasteNodeFromSnapshot,
  });

  const {
    isSpacePanning,
    beginSpacePan,
    endSpacePan,
    onSpacePanPointerDown,
    onSpacePanPointerMove,
    onSpacePanPointerUp,
    onSpacePanPointerCancel,
  } = useSpacePanController({
    cancelPan,
    panPointerDown,
    panPointerMove,
    panPointerUp,
    panPointerCancel,
    collabPointerMove,
    onLocalCursorModeChange,
  });

  useCanvasHotkeys({
    viewportRef,
    selectedNodeIds,
    tool,
    isSpacePanning,
    clearSelection,
    deleteSelection,
    duplicateSelection,
    copySelection,
    pasteClipboard,
    canPaste,
    setTool,
    beginSpacePan,
    endSpacePan,
    zoomIn,
    zoomOut,
  });

  return {
    isSpacePanning,
    onSpacePanPointerDown,
    onSpacePanPointerMove,
    onSpacePanPointerUp,
    onSpacePanPointerCancel,
  };
}

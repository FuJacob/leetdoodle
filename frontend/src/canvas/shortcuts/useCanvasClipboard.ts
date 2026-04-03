import { useCallback, useRef } from "react";
import type { CanvasNode } from "../../shared/nodes";

interface UseCanvasClipboardArgs {
  nodesRef: React.RefObject<CanvasNode[]>;
  selectedNodeIds: Set<string>;
  cloneNode: (nodeId: string) => void;
  pasteNodeFromSnapshot: (sourceNode: CanvasNode) => void;
}

function cloneNodeSnapshot(node: CanvasNode): CanvasNode {
  if (typeof structuredClone === "function") {
    return structuredClone(node);
  }

  return JSON.parse(JSON.stringify(node)) as CanvasNode;
}

/**
 * Owns the in-memory canvas clipboard for copy, duplicate, and paste actions.
 *
 * The clipboard stores a deep-cloned node snapshot so shortcut handling can
 * operate without reaching back into canvas state orchestration.
 */
export function useCanvasClipboard({
  nodesRef,
  selectedNodeIds,
  cloneNode,
  pasteNodeFromSnapshot,
}: UseCanvasClipboardArgs) {
  const clipboardRef = useRef<CanvasNode | null>(null);

  const duplicateSelection = useCallback(() => {
    if (selectedNodeIds.size !== 1) return;
    cloneNode(selectedNodeIds.values().next().value!);
  }, [cloneNode, selectedNodeIds]);

  const copySelection = useCallback(() => {
    if (selectedNodeIds.size !== 1) return;

    const selectedNodeId = selectedNodeIds.values().next().value!;
    const selectedNode = nodesRef.current.find((node) => node.id === selectedNodeId);
    if (!selectedNode) return;

    clipboardRef.current = cloneNodeSnapshot(selectedNode);
  }, [nodesRef, selectedNodeIds]);

  const pasteClipboard = useCallback(() => {
    if (!clipboardRef.current) return;
    pasteNodeFromSnapshot(clipboardRef.current);
  }, [pasteNodeFromSnapshot]);

  const canPaste = useCallback(() => clipboardRef.current !== null, []);

  return {
    copySelection,
    duplicateSelection,
    pasteClipboard,
    canPaste,
  };
}

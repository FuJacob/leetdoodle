import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CanvasNode } from "../../shared/nodes";
import type { LocalCursorMode } from "../types";
import type { CanvasTool } from "../tools/types";
import { eventToShortcutCombo, isEscapeCombo } from "./keymap";
import { ShortcutRegistry } from "./registry";
import type { ShortcutCommands, ShortcutContext } from "./types";

interface UseCanvasShortcutContainerArgs {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  nodes: CanvasNode[];
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
  collabPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onLocalCursorModeChange: (mode: LocalCursorMode) => void;
}

interface ShortcutState {
  nodes: CanvasNode[];
  selectedNodeIds: Set<string>;
  tool: CanvasTool;
  isSpacePanning: boolean;
}

function cloneNodeSnapshot(node: CanvasNode): CanvasNode {
  if (typeof structuredClone === "function") {
    return structuredClone(node);
  }

  return JSON.parse(JSON.stringify(node)) as CanvasNode;
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  if (
    target.closest("input, textarea, select, [contenteditable], .cm-editor, [role='textbox']")
  ) {
    return true;
  }

  return target.isContentEditable;
}

function isCanvasEventTarget(
  target: EventTarget | null,
  viewport: HTMLDivElement | null,
): boolean {
  if (!viewport) return false;
  if (!(target instanceof Node)) return false;

  if (viewport.contains(target)) return true;

  return target === document.body || target === document.documentElement;
}

export function useCanvasShortcutContainer({
  viewportRef,
  nodes,
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
  collabPointerMove,
  onLocalCursorModeChange,
}: UseCanvasShortcutContainerArgs) {
  const [isSpacePanning, setIsSpacePanning] = useState(false);
  const clipboardRef = useRef<CanvasNode | null>(null);
  const stateRef = useRef<ShortcutState>({
    nodes,
    selectedNodeIds,
    tool,
    isSpacePanning,
  });
  const commandsRef = useRef<ShortcutCommands>({
    clearSelection: () => {},
    deleteSelection: () => {},
    duplicateSelection: () => {},
    copySelection: () => {},
    pasteClipboard: () => {},
    setTool: () => {},
    beginSpacePan: () => {},
    endSpacePan: () => {},
  });
  const registryRef = useRef<ShortcutRegistry>(new ShortcutRegistry());

  useLayoutEffect(() => {
    stateRef.current = {
      nodes,
      selectedNodeIds,
      tool,
      isSpacePanning,
    };
  }, [nodes, selectedNodeIds, tool, isSpacePanning]);

  useEffect(() => {
    commandsRef.current = {
      clearSelection: () => {
        selectNodes(new Set());
      },
      deleteSelection: () => {
        const ids = stateRef.current.selectedNodeIds;
        if (ids.size === 0) return;
        for (const nodeId of ids) {
          deleteNode(nodeId);
        }
      },
      duplicateSelection: () => {
        const ids = stateRef.current.selectedNodeIds;
        if (ids.size !== 1) return;
        cloneNode(ids.values().next().value!);
      },
      copySelection: () => {
        const ids = stateRef.current.selectedNodeIds;
        if (ids.size !== 1) return;
        const nodeId = ids.values().next().value!;
        const selectedNode = stateRef.current.nodes.find((node) => node.id === nodeId);
        if (!selectedNode) return;
        clipboardRef.current = cloneNodeSnapshot(selectedNode);
      },
      pasteClipboard: () => {
        if (!clipboardRef.current) return;
        pasteNodeFromSnapshot(clipboardRef.current);
      },
      setTool,
      beginSpacePan: () => {
        if (stateRef.current.isSpacePanning) return;
        onLocalCursorModeChange("pointer");
        setIsSpacePanning(true);
      },
      endSpacePan: () => {
        if (!stateRef.current.isSpacePanning) return;
        setIsSpacePanning(false);
      },
    };
  }, [
    selectNodes,
    deleteNode,
    cloneNode,
    pasteNodeFromSnapshot,
    setTool,
    onLocalCursorModeChange,
  ]);

  const buildContext = useCallback(
    (event: KeyboardEvent): ShortcutContext => {
      const currentState = stateRef.current;
      const viewport = viewportRef.current;
      const target = event.target;
      const activeElement = document.activeElement;

      return {
        selectedNodeIds: currentState.selectedNodeIds,
        tool: currentState.tool,
        isSpacePanning: currentState.isSpacePanning,
        isEditableTarget: isEditableEventTarget(target),
        isCanvasEventTarget: isCanvasEventTarget(target, viewport),
        isViewportFocused:
          !!viewport && activeElement instanceof Node && viewport.contains(activeElement),
        commands: commandsRef.current,
      };
    },
    [viewportRef],
  );

  useEffect(() => {
    const registry = registryRef.current;
    registry.clear();

    const unregisterFns = [
      registry.register({
        id: "clear-selection",
        combos: ["escape"],
        scope: "global",
        handler: ({ commands }) => {
          commands.endSpacePan();
          commands.clearSelection();
        },
      }),
      registry.register({
        id: "delete-selection",
        combos: ["delete", "backspace"],
        scope: "selection",
        handler: ({ commands }) => {
          commands.deleteSelection();
        },
      }),
      registry.register({
        id: "copy-selection",
        combos: ["mod+c"],
        scope: "selection",
        handler: ({ commands }) => {
          commands.copySelection();
        },
      }),
      registry.register({
        id: "paste-node",
        combos: ["mod+v"],
        scope: "canvas",
        enabled: () => clipboardRef.current !== null,
        handler: ({ commands }) => {
          commands.pasteClipboard();
        },
      }),
      registry.register({
        id: "duplicate-selection",
        combos: ["mod+d"],
        scope: "selection",
        handler: ({ commands }) => {
          commands.duplicateSelection();
        },
      }),
      registry.register({
        id: "tool-select",
        combos: ["v"],
        scope: "canvas",
        handler: ({ commands }) => {
          commands.setTool("select");
        },
      }),
      registry.register({
        id: "tool-draw",
        combos: ["d"],
        scope: "canvas",
        handler: ({ commands }) => {
          commands.setTool("draw");
        },
      }),
      registry.register({
        id: "space-pan-start",
        combos: ["space"],
        scope: "canvas",
        handler: ({ commands }) => {
          commands.beginSpacePan();
        },
      }),
    ];

    return () => {
      unregisterFns.forEach((unregister) => unregister());
    };
  }, []);

  useEffect(() => {
    const registry = registryRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      const combo = eventToShortcutCombo(event);
      if (!combo) return;

      const context = buildContext(event);

      if (context.isEditableTarget && !isEscapeCombo(combo)) {
        return;
      }

      const binding = registry.resolve(combo, event, context);
      if (!binding) return;

      if (binding.preventDefault ?? true) {
        event.preventDefault();
        event.stopPropagation();
      }

      binding.handler(context, event);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== " ") return;
      commandsRef.current?.endSpacePan();
    };

    const handleWindowBlur = () => {
      commandsRef.current?.endSpacePan();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [buildContext]);

  const onSpacePanPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      panPointerDown(event);
    },
    [panPointerDown],
  );

  const onSpacePanPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      panPointerMove(event);
      collabPointerMove(event);
    },
    [panPointerMove, collabPointerMove],
  );

  const onSpacePanPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      panPointerUp(event);
    },
    [panPointerUp],
  );

  return {
    isSpacePanning,
    onSpacePanPointerDown,
    onSpacePanPointerMove,
    onSpacePanPointerUp,
  };
}

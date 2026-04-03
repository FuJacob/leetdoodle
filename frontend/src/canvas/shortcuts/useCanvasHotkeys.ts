import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { CanvasTool } from "../tools/types";
import { eventToShortcutCombo, isEscapeCombo } from "./keymap";
import { ShortcutRegistry } from "./registry";
import type { ShortcutCommands, ShortcutContext } from "./types";

interface UseCanvasHotkeysArgs {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  selectedNodeIds: Set<string>;
  tool: CanvasTool;
  isSpacePanning: boolean;
  clearSelection: () => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  canPaste: () => boolean;
  setTool: (tool: CanvasTool) => void;
  beginSpacePan: () => void;
  endSpacePan: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface ShortcutState {
  selectedNodeIds: Set<string>;
  tool: CanvasTool;
  isSpacePanning: boolean;
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  if (
    target.closest(
      "input, textarea, select, [contenteditable], .cm-editor, [role='textbox']",
    )
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

/**
 * Registers and executes keyboard shortcuts for the canvas surface.
 *
 * This hook owns shortcut scope resolution, editable-target guards, and the
 * browser event listeners that dispatch into the shared shortcut registry.
 */
export function useCanvasHotkeys({
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
}: UseCanvasHotkeysArgs) {
  const stateRef = useRef<ShortcutState>({
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
    zoomIn: () => {},
    zoomOut: () => {},
  });
  const registryRef = useRef<ShortcutRegistry>(new ShortcutRegistry());

  useLayoutEffect(() => {
    stateRef.current = {
      selectedNodeIds,
      tool,
      isSpacePanning,
    };
  }, [selectedNodeIds, tool, isSpacePanning]);

  useEffect(() => {
    commandsRef.current = {
      clearSelection,
      deleteSelection,
      duplicateSelection,
      copySelection,
      pasteClipboard,
      setTool,
      beginSpacePan,
      endSpacePan,
      zoomIn,
      zoomOut,
    };
  }, [
    beginSpacePan,
    clearSelection,
    copySelection,
    deleteSelection,
    duplicateSelection,
    endSpacePan,
    pasteClipboard,
    setTool,
    zoomIn,
    zoomOut,
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
          !!viewport &&
          activeElement instanceof Node &&
          viewport.contains(activeElement),
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
        enabled: () => canPaste(),
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
      registry.register({
        id: "zoom-in",
        combos: ["equal", "shift+equal"],
        scope: "canvas",
        allowRepeat: true,
        handler: ({ commands }) => {
          commands.zoomIn();
        },
      }),
      registry.register({
        id: "zoom-out",
        combos: ["minus", "shift+minus"],
        scope: "canvas",
        allowRepeat: true,
        handler: ({ commands }) => {
          commands.zoomOut();
        },
      }),
    ];

    return () => {
      unregisterFns.forEach((unregister) => unregister());
    };
  }, [canPaste]);

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
      commandsRef.current.endSpacePan();
    };

    const handleWindowBlur = () => {
      commandsRef.current.endSpacePan();
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
}

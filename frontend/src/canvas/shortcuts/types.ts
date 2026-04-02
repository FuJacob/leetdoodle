import type { CanvasTool } from "../tools/types";

export type ShortcutScope = "global" | "canvas" | "selection";

export interface ShortcutCommands {
  clearSelection: () => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  setTool: (tool: CanvasTool) => void;
  beginSpacePan: () => void;
  endSpacePan: () => void;
}

export interface ShortcutContext {
  selectedNodeIds: Set<string>;
  tool: CanvasTool;
  isSpacePanning: boolean;
  isEditableTarget: boolean;
  isCanvasEventTarget: boolean;
  isViewportFocused: boolean;
  commands: ShortcutCommands;
}

export interface ShortcutBinding {
  id: string;
  combos: string[];
  scope: ShortcutScope;
  priority?: number;
  allowRepeat?: boolean;
  preventDefault?: boolean;
  enabled?: (context: ShortcutContext) => boolean;
  handler: (context: ShortcutContext, event: KeyboardEvent) => void;
}

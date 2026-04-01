import { IconBrush, IconCode, IconNote, IconPointer, IconPuzzle } from "@tabler/icons-react";
import type { ComponentType } from "react";
import type { NodeType } from "../../shared/nodes";
import type { CanvasTool } from "../tools/types";

export const CONTROL_ICON_SIZE = 20;
export const CONTROL_ICON_STROKE = 1.9;
export const OVERLAY_ACTION_ICON_SIZE = 22;

type IconProps = {
  size?: number | string;
  stroke?: number | string;
  className?: string;
};

export type CanvasIconComponent = ComponentType<IconProps>;

type SpawnableNodeType = Extract<NodeType, "note" | "problem" | "code">;

export interface NodeControlOption {
  type: SpawnableNodeType;
  label: string;
  Icon: CanvasIconComponent;
}

export interface ToolControlOption {
  tool: CanvasTool;
  label: string;
  Icon: CanvasIconComponent;
}

export const NODE_CONTROL_OPTIONS: NodeControlOption[] = [
  { type: "note", label: "Note", Icon: IconNote },
  { type: "problem", label: "Problem", Icon: IconPuzzle },
  { type: "code", label: "Code", Icon: IconCode },
];

export const TOOL_CONTROL_OPTIONS: ToolControlOption[] = [
  { tool: "select", label: "Select", Icon: IconPointer },
  { tool: "draw", label: "Draw", Icon: IconBrush },
];

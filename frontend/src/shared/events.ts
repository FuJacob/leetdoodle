import type { CanvasNode, Edge } from "./nodes";

// All events that can be sent/received over the WebSocket.
// The server broadcasts these to all clients in the same canvas.

export type CanvasEvent =
  | { type: "cursor_move"; userId: string; x: number; y: number }
  | { type: "node_create"; node: CanvasNode }
  | { type: "node_move"; nodeId: string; x: number; y: number }
  | { type: "node_update"; nodeId: string; patch: Partial<CanvasNode> }
  | { type: "node_delete"; nodeId: string }
  | { type: "edge_create"; edge: Edge }
  | { type: "edge_delete"; edgeId: string }
  | { type: "node_select"; userId: string; nodeId: string | null }
  | { type: "user_leave"; userId: string };

// Callbacks for handling remote events — Canvas provides these to the hook
export interface CanvasEventHandlers {
  onNodeCreate?: (node: CanvasNode) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onNodeUpdate?: (nodeId: string, patch: Partial<CanvasNode>) => void;
  onNodeDelete?: (nodeId: string) => void;
  onEdgeCreate?: (edge: Edge) => void;
  onEdgeDelete?: (edgeId: string) => void;
  onNodeSelect?: (userId: string, nodeId: string | null) => void;
  onUserLeave?: (userId: string) => void;
}

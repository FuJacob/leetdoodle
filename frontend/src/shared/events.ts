import type { CrdtOp, StateVector } from "./crdt";
import type { CanvasNode, Edge } from "./nodes";

export interface CanvasPresenceUser {
  id: string;
  displayName: string;
  color: string;
}

/**
 * Outbound events this client can send to the relay server.
 *
 * The server stays mostly schema-agnostic and fan-outs payloads by canvas room.
 */
export type CanvasOutboundEvent =
  | { type: "cursor_move"; userId: string; x: number; y: number }
  | { type: "node_create"; node: CanvasNode }
  | { type: "node_move"; nodeId: string; x: number; y: number }
  | { type: "node_drag_start"; nodeIds: string[] }
  | { type: "node_drag_end" }
  | { type: "node_update"; nodeId: string; patch: Partial<CanvasNode> }
  | { type: "node_delete"; nodeId: string }
  | { type: "edge_create"; edge: Edge }
  | { type: "edge_delete"; edgeId: string }
  | { type: "node_select"; userId: string; nodeIds: string[] }
  | { type: "crdt_op"; docId: string; op: CrdtOp }
  | { type: "sync_request"; docId: string; stateVector: StateVector }
  | { type: "draw_points"; points: Array<[number, number]>; thickness: number }
  | { type: "draw_end" };

/**
 * Inbound events this client may receive from the server.
 */
export type CanvasInboundEvent =
  | { type: "presence_snapshot"; users: CanvasPresenceUser[] }
  | { type: "user_join"; user: CanvasPresenceUser }
  | { type: "cursor_move"; userId: string; x: number; y: number }
  | { type: "node_create"; userId: string; node: CanvasNode }
  | { type: "node_move"; userId: string; nodeId: string; x: number; y: number }
  | { type: "node_drag_start"; userId: string; nodeIds: string[] }
  | { type: "node_drag_end"; userId: string }
  | {
      type: "node_update";
      userId: string;
      nodeId: string;
      patch: Partial<CanvasNode>;
    }
  | { type: "node_delete"; userId: string; nodeId: string }
  | { type: "edge_create"; userId: string; edge: Edge }
  | { type: "edge_delete"; userId: string; edgeId: string }
  | { type: "node_select"; userId: string; nodeIds: string[] }
  | { type: "user_leave"; userId: string }
  | { type: "crdt_op"; userId: string; docId: string; op: CrdtOp }
  | { type: "sync_response"; docId: string; ops: CrdtOp[] }
  | {
      type: "draw_points";
      userId: string;
      points: Array<[number, number]>;
      thickness: number;
    }
  | { type: "draw_end"; userId: string };

export interface CanvasEventHandlers {
  onNodeCreate?: (node: CanvasNode) => void;
  onNodeMove?: (userId: string, nodeId: string, x: number, y: number) => void;
  onNodeDragStart?: (userId: string, nodeIds: string[]) => void;
  onNodeDragEnd?: (userId: string) => void;
  onNodeUpdate?: (nodeId: string, patch: Partial<CanvasNode>) => void;
  onNodeDelete?: (nodeId: string) => void;
  onEdgeCreate?: (edge: Edge) => void;
  onEdgeDelete?: (edgeId: string) => void;
  onNodeSelect?: (userId: string, nodeIds: string[]) => void;
  onUserJoin?: (user: CanvasPresenceUser) => void;
  onUserLeave?: (userId: string) => void;
  onCrdtOp?: (docId: string, op: CrdtOp, senderUserId: string) => void;
  onSyncResponse?: (docId: string, ops: CrdtOp[]) => void;
}

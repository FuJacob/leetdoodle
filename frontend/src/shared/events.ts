import type { CrdtOp, StateVector } from "./crdt";
import type { CanvasNode, Edge } from "./nodes";

/**
 * Outbound events this client can send to the relay server.
 *
 * The server stays mostly schema-agnostic and fan-outs payloads by canvas room.
 */
export type CanvasOutboundEvent =
  | { type: "cursor_move"; userId: string; x: number; y: number }
  | { type: "node_create"; node: CanvasNode }
  | { type: "node_move"; nodeId: string; x: number; y: number }
  | { type: "node_update"; nodeId: string; patch: Partial<CanvasNode> }
  | { type: "node_delete"; nodeId: string }
  | { type: "edge_create"; edge: Edge }
  | { type: "edge_delete"; edgeId: string }
  | { type: "node_select"; userId: string; nodeId: string | null }
  | { type: "crdt_op"; docId: string; op: CrdtOp }
  | { type: "sync_request"; docId: string; stateVector: StateVector };

/**
 * Inbound events this client may receive from the server.
 */
export type CanvasInboundEvent =
  | { type: "presence_snapshot"; userIds: string[] }
  | { type: "user_join"; userId: string }
  | { type: "cursor_move"; userId: string; x: number; y: number }
  | { type: "node_create"; userId: string; node: CanvasNode }
  | { type: "node_move"; userId: string; nodeId: string; x: number; y: number }
  | {
      type: "node_update";
      userId: string;
      nodeId: string;
      patch: Partial<CanvasNode>;
    }
  | { type: "node_delete"; userId: string; nodeId: string }
  | { type: "edge_create"; userId: string; edge: Edge }
  | { type: "edge_delete"; userId: string; edgeId: string }
  | { type: "node_select"; userId: string; nodeId: string | null }
  | { type: "user_leave"; userId: string }
  | { type: "crdt_op"; userId: string; docId: string; op: CrdtOp }
  | { type: "sync_response"; docId: string; ops: CrdtOp[] };

export interface CanvasEventHandlers {
  onNodeCreate?: (node: CanvasNode) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onNodeUpdate?: (nodeId: string, patch: Partial<CanvasNode>) => void;
  onNodeDelete?: (nodeId: string) => void;
  onEdgeCreate?: (edge: Edge) => void;
  onEdgeDelete?: (edgeId: string) => void;
  onNodeSelect?: (userId: string, nodeId: string | null) => void;
  onUserJoin?: (userId: string) => void;
  onUserLeave?: (userId: string) => void;
  onCrdtOp?: (docId: string, op: CrdtOp, senderUserId: string) => void;
  onSyncResponse?: (docId: string, ops: CrdtOp[]) => void;
}

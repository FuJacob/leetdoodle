import type { CrdtOp, StateVector } from "./crdt";
import type { CanvasNode, Edge } from "./nodes";

export interface CanvasPresenceUser {
  id: string;
  displayName: string;
  color: string;
}

export type CanvasStructuralEventType =
  | "node_create"
  | "node_move"
  | "node_update"
  | "node_delete"
  | "edge_create"
  | "edge_delete";

export type CanvasOutboundStructuralEvent =
  | { type: "node_create"; clientOperationId: string; node: CanvasNode }
  | {
      type: "node_move";
      clientOperationId: string;
      nodeId: string;
      x: number;
      y: number;
    }
  | {
      type: "node_update";
      clientOperationId: string;
      nodeId: string;
      patch: Partial<CanvasNode>;
    }
  | { type: "node_delete"; clientOperationId: string; nodeId: string }
  | { type: "edge_create"; clientOperationId: string; edge: Edge }
  | { type: "edge_delete"; clientOperationId: string; edgeId: string };

export type CanvasImmediateOutboundEvent =
  | { type: "cursor_move"; userId: string; x: number; y: number }
  | { type: "node_drag_start"; nodeIds: string[] }
  | { type: "node_drag_end" }
  | { type: "node_select"; userId: string; nodeIds: string[] }
  | { type: "crdt_op"; docId: string; op: CrdtOp }
  | { type: "sync_request"; docId: string; stateVector: StateVector }
  | { type: "draw_points"; points: Array<[number, number]>; thickness: number }
  | { type: "draw_end" };

/**
 * Outbound events this client can send to the relay server.
 *
 * Structural graph edits carry a clientOperationId so the sender can reconcile
 * optimistic local state with the committed event echoed back by the server.
 */
export type CanvasOutboundEvent =
  | CanvasOutboundStructuralEvent
  | CanvasImmediateOutboundEvent;

export interface CanvasBootstrapEvent {
  type: "canvas_bootstrap";
  canvasId: string;
  headVersion: number;
  nodes: CanvasNode[];
  edges: Edge[];
}

interface CanvasCommittedStructuralEventBase {
  canvasId: string;
  userId: string;
  version: number;
  eventId: string;
  clientOperationId: string;
}

export type CanvasCommittedStructuralEvent =
  | (CanvasCommittedStructuralEventBase & {
      type: "node_create";
      node: CanvasNode;
    })
  | (CanvasCommittedStructuralEventBase & {
      type: "node_move";
      nodeId: string;
      x: number;
      y: number;
    })
  | (CanvasCommittedStructuralEventBase & {
      type: "node_update";
      nodeId: string;
      patch: Partial<CanvasNode>;
    })
  | (CanvasCommittedStructuralEventBase & {
      type: "node_delete";
      nodeId: string;
    })
  | (CanvasCommittedStructuralEventBase & {
      type: "edge_create";
      edge: Edge;
    })
  | (CanvasCommittedStructuralEventBase & {
      type: "edge_delete";
      edgeId: string;
    });

/**
 * Inbound events this client may receive from the server.
 */
export type CanvasInboundEvent =
  | { type: "presence_snapshot"; users: CanvasPresenceUser[] }
  | CanvasBootstrapEvent
  | { type: "user_join"; user: CanvasPresenceUser }
  | { type: "cursor_move"; userId: string; x: number; y: number }
  | CanvasCommittedStructuralEvent
  | { type: "node_drag_start"; userId: string; nodeIds: string[] }
  | { type: "node_drag_end"; userId: string }
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
  onNodeMove?: (userId: string, nodeId: string, x: number, y: number) => void;
  onNodeDragStart?: (userId: string, nodeIds: string[]) => void;
  onNodeDragEnd?: (userId: string) => void;
  onNodeSelect?: (userId: string, nodeIds: string[]) => void;
  onUserJoin?: (user: CanvasPresenceUser) => void;
  onUserLeave?: (userId: string) => void;
  onCrdtOp?: (docId: string, op: CrdtOp, senderUserId: string) => void;
  onSyncResponse?: (docId: string, ops: CrdtOp[]) => void;
}

/**
 * Identify durable structural outbound events so the queue can own them.
 */
export function isStructuralOutboundEvent(
  event: CanvasOutboundEvent,
): event is CanvasOutboundStructuralEvent {
  return (
    event.type === "node_create" ||
    event.type === "node_move" ||
    event.type === "node_update" ||
    event.type === "node_delete" ||
    event.type === "edge_create" ||
    event.type === "edge_delete"
  );
}

/**
 * Identify committed structural inbound events emitted after persistence.
 */
export function isCommittedStructuralInboundEvent(
  event: CanvasInboundEvent,
): event is CanvasCommittedStructuralEvent {
  return (
    event.type === "node_create" ||
    event.type === "node_move" ||
    event.type === "node_update" ||
    event.type === "node_delete" ||
    event.type === "edge_create" ||
    event.type === "edge_delete"
  );
}

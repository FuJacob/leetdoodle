import { useCallback, useEffect, useRef, useState } from "react";
import type { Transform } from "../types";
import type {
  CanvasEventHandlers,
  CanvasInboundEvent,
  CanvasOutboundEvent,
} from "../../shared/events";
import { screenToWorld } from "../utils/coordinates";
import { COLLAB_WS_URL } from "../../shared/config/env";
import type { CursorPresenceStore } from "../presence/cursorPresenceStore";
import type { CollabUser, RemoteStroke } from "../presence/types";

const CURSOR_MOVE_UPDATE_INTERVAL = 17;

/**
 * Owns the shared canvas WebSocket session and routes inbound events by
 * concern: document changes stay in React state/callbacks, while high-frequency
 * remote cursor updates are written into an external presence store.
 */
export function useCanvasCollab(
  canvasId: string,
  userId: string,
  displayName: string,
  viewportRef: React.RefObject<HTMLDivElement | null>,
  transformRef: React.RefObject<Transform>,
  cursorStore: CursorPresenceStore,
  handlers: CanvasEventHandlers = {},
) {
  const [users, setUsers] = useState<CollabUser[]>([]);
  // Active in-progress strokes from remote users, keyed by userId.
  // Points are world-space, accumulated as draw_points batches arrive.
  // Cleared when draw_end arrives or the user leaves.
  const [remoteStrokes, setRemoteStrokes] = useState<Map<string, RemoteStroke>>(
    new Map(),
  );
  const wsRef = useRef<WebSocket | null>(null);
  const lastCursorSentAt = useRef(0);

  // Keep newest callbacks without reconnecting the socket every render.
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const ws = new WebSocket(COLLAB_WS_URL);

    ws.onopen = () => {
      // Reset local collab state when a fresh socket session is established.
      setUsers([]);
      cursorStore.clear();
      setRemoteStrokes(new Map());

      // Assign only when open so stale constructing sockets cannot clobber ref.
      wsRef.current = ws;
      ws.send(JSON.stringify({ type: "join", canvasId, userId, displayName }));
    };

    ws.onmessage = (event) => {
      let msg: CanvasInboundEvent;
      try {
        msg = JSON.parse(event.data as string) as CanvasInboundEvent;
      } catch (error) {
        console.error("Failed to parse WebSocket message", error);
        return;
      }

      // The relay currently echoes to all peers except sender for most events,
      // but this guard is still useful for safety and future server changes.
      if ("userId" in msg && msg.userId === userId) return;

      switch (msg.type) {
        case "presence_snapshot":
          setUsers(() =>
            [...msg.users]
              .map((user) => ({
                ...user,
                displayName:
                  typeof user.displayName === "string" &&
                  user.displayName.trim().length > 0
                    ? user.displayName
                    : user.id,
              }))
              .sort((a, b) => {
                if (a.id === userId) return -1;
                if (b.id === userId) return 1;
                return a.id.localeCompare(b.id);
              }),
          );
          break;

        case "user_join":
          handlersRef.current.onUserJoin?.({
            ...msg.user,
            displayName:
              typeof msg.user.displayName === "string" &&
              msg.user.displayName.trim().length > 0
                ? msg.user.displayName
                : msg.user.id,
          });
          setUsers((prev) => {
            const userWithDisplayName = {
              ...msg.user,
              displayName:
                typeof msg.user.displayName === "string" &&
                msg.user.displayName.trim().length > 0
                  ? msg.user.displayName
                  : msg.user.id,
            };
            const others = prev.filter((user) => user.id !== msg.user.id);
            return [...others, userWithDisplayName].sort((a, b) => {
              if (a.id === userId) return -1;
              if (b.id === userId) return 1;
              return a.id.localeCompare(b.id);
            });
          });
          break;

        case "cursor_move":
          cursorStore.upsertCursor({
            userId: msg.userId,
            x: msg.x,
            y: msg.y,
          });
          break;

        case "node_create":
          handlersRef.current.onNodeCreate?.(msg.node);
          break;

        case "node_move":
          handlersRef.current.onNodeMove?.(
            msg.userId,
            msg.nodeId,
            msg.x,
            msg.y,
          );
          break;

        case "node_drag_start":
          handlersRef.current.onNodeDragStart?.(msg.userId, msg.nodeIds);
          break;

        case "node_drag_end":
          handlersRef.current.onNodeDragEnd?.(msg.userId);
          break;

        case "node_update":
          handlersRef.current.onNodeUpdate?.(msg.nodeId, msg.patch);
          break;

        case "node_delete":
          handlersRef.current.onNodeDelete?.(msg.nodeId);
          break;

        case "edge_create":
          handlersRef.current.onEdgeCreate?.(msg.edge);
          break;

        case "edge_delete":
          handlersRef.current.onEdgeDelete?.(msg.edgeId);
          break;

        case "node_select":
          handlersRef.current.onNodeSelect?.(msg.userId, msg.nodeIds);
          break;

        case "draw_points":
          setRemoteStrokes((prev) => {
            const next = new Map(prev);
            const existing = next.get(msg.userId);
            next.set(msg.userId, {
              points: [...(existing?.points ?? []), ...msg.points],
              thickness: msg.thickness ?? existing?.thickness ?? 2,
            });
            return next;
          });
          break;

        case "draw_end":
          setRemoteStrokes((prev) => {
            const next = new Map(prev);
            next.delete(msg.userId);
            return next;
          });
          break;

        case "user_leave":
          setUsers((prev) => prev.filter((user) => user.id !== msg.userId));
          cursorStore.removeCursor(msg.userId);
          setRemoteStrokes((prev) => {
            const next = new Map(prev);
            next.delete(msg.userId);
            return next;
          });
          handlersRef.current.onUserLeave?.(msg.userId);
          break;

        case "crdt_op":
          handlersRef.current.onCrdtOp?.(msg.docId, msg.op, msg.userId);
          break;

        case "sync_response":
          handlersRef.current.onSyncResponse?.(msg.docId, msg.ops);
          break;
      }
    };

    ws.onclose = () => {
      // StrictMode-safe: only clear if this exact socket is still current.
      if (wsRef.current === ws) wsRef.current = null;

      setUsers([]);
      cursorStore.clear();
      setRemoteStrokes(new Map());
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    return () => {
      cursorStore.clear();
      ws.close();
    };
  }, [canvasId, userId, displayName, cursorStore]);

  const send = useCallback(
    (event: CanvasOutboundEvent) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // canvasId + userId are envelope metadata used by relay/router logic.
      ws.send(JSON.stringify({ ...event, canvasId, userId }));
    },
    [canvasId, userId],
  );

  // Throttled cursor move updates (50fps) to cap network spam.
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const now = performance.now();
      if (now - lastCursorSentAt.current < CURSOR_MOVE_UPDATE_INTERVAL) return;
      lastCursorSentAt.current = now;

      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      const world = screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top,
        transformRef.current,
      );

      send({ type: "cursor_move", userId, x: world.x, y: world.y });
    },
    [userId, viewportRef, transformRef, send],
  );

  return { users, remoteStrokes, send, onPointerMove };
}

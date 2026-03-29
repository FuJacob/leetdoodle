import { useCallback, useEffect, useRef, useState } from "react";
import type { Transform } from "../types";
import type {
  CanvasEventHandlers,
  CanvasInboundEvent,
  CanvasOutboundEvent,
} from "../../shared/events";
import { screenToWorld } from "../utils/coordinates";

export interface RemoteCursor {
  userId: string;
  x: number; // world-space
  y: number;
}

export function useCanvasCollab(
  canvasId: string,
  userId: string,
  viewportRef: React.RefObject<HTMLDivElement | null>,
  transformRef: React.RefObject<Transform>,
  handlers: CanvasEventHandlers = {},
) {
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const [users, setUsers] = useState<string[]>(() => [userId]);
  const wsRef = useRef<WebSocket | null>(null);
  const lastCursorSentAt = useRef(0);

  // Keep newest callbacks without reconnecting the socket every render.
  const handlersRef = useRef(handlers);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080/ws");

    ws.onopen = () => {
      // Reset local collab state when a fresh socket session is established.
      setUsers([userId]);
      setCursors(new Map());

      // Assign only when open so stale constructing sockets cannot clobber ref.
      wsRef.current = ws;
      ws.send(JSON.stringify({ type: "join", canvasId, userId }));
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
          setUsers(() => {
            const next = new Set<string>([userId]);
            console.log(msg.userIds);
            for (const id of msg.userIds) {
              next.add(id);
            }
            const ordered = Array.from(next)
              .filter((id) => id !== userId)
              .sort();
            return [userId, ...ordered];
          });
          break;

        case "user_join":
          handlersRef.current.onUserJoin?.(msg.userId);
          setUsers((prev) => {
            if (prev.includes(msg.userId)) return prev;
            return [...prev, msg.userId].sort((a, b) => {
              if (a === userId) return -1;
              if (b === userId) return 1;
              return a.localeCompare(b);
            });
          });
          break;

        case "cursor_move":
          setCursors((prev) =>
            new Map(prev).set(msg.userId, {
              userId: msg.userId,
              x: msg.x,
              y: msg.y,
            }),
          );
          break;

        case "node_create":
          handlersRef.current.onNodeCreate?.(msg.node);
          break;

        case "node_move":
          handlersRef.current.onNodeMove?.(msg.nodeId, msg.x, msg.y);
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
          handlersRef.current.onNodeSelect?.(msg.userId, msg.nodeId);
          break;

        case "user_leave":
          setUsers((prev) => prev.filter((id) => id !== msg.userId));
          setCursors((prev) => {
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

      setUsers([userId]);
      setCursors(new Map());
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    return () => {
      ws.close();
    };
  }, [canvasId, userId]);

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
      if (now - lastCursorSentAt.current < 20) return;
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

  return { cursors, users, send, onPointerMove };
}

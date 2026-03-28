import { useCallback, useEffect, useRef, useState } from "react";
import type { Transform } from "../types";
import type { CanvasEvent, CanvasEventHandlers } from "../../shared/events";
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
  const wsRef = useRef<WebSocket | null>(null);
  const lastCursorSentAt = useRef(0);

  // Store handlers in a ref so we don't reconnect when they change
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080/ws");

    ws.onopen = () => {
      wsRef.current = ws;
      ws.send(JSON.stringify({ type: "join", canvasId, userId }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as CanvasEvent & { userId?: string };

      // Ignore our own events (server echoes back to sender too)
      if ("userId" in msg && msg.userId === userId) return;

      switch (msg.type) {
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
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    return () => {
      ws.close();
    };
  }, [canvasId, userId]);

  // Send any canvas event to the server
  const send = useCallback(
    (event: CanvasEvent) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      // Attach canvasId so server knows which room to broadcast to
      ws.send(JSON.stringify({ ...event, canvasId, userId }));
    },
    [canvasId, userId],
  );

  // Throttled cursor move — plugged into the viewport's onPointerMove
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const now = performance.now();
      if (now - lastCursorSentAt.current < 20) return; // 50fps throttle
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

  return { cursors, send, onPointerMove };
}

import { useCallback, useEffect, useRef, useState } from "react";
import type { Transform } from "../types";
import { screenToWorld } from "../utils/coordinates";

export interface RemoteCursor {
  userId: string;
  x: number; // world-space
  y: number;
}

export function useCollabCursors(
  canvasId: string,
  userId: string,
  viewportRef: React.RefObject<HTMLDivElement | null>,
  transformRef: React.RefObject<Transform>,
) {
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const lastSentAt = useRef(0);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080/ws");

    ws.onopen = () => {
      wsRef.current = ws;
      ws.send(JSON.stringify({ type: "join", canvasId, userId }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string);
      if (msg.type === "cursor" && msg.userId !== userId) {
        setCursors((prev) =>
          new Map(prev).set(msg.userId, {
            userId: msg.userId,
            x: msg.x,
            y: msg.y,
          }),
        );
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      ws.close();
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  }, [canvasId, userId]);

  // Throttled to 50fps — plugged into the viewport's onPointerMove
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const now = performance.now();
      if (now - lastSentAt.current < 20) return;
      lastSentAt.current = now;

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      const world = screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top,
        transformRef.current,
      );

      ws.send(
        JSON.stringify({
          type: "cursor",
          canvasId,
          userId,
          x: world.x,
          y: world.y,
        }),
      );
    },
    [canvasId, userId, viewportRef, transformRef],
  );

  return { cursors, onPointerMove };
}

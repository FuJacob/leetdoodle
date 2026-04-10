import { useCallback, useEffect, useRef, useState } from "react";
import type { Transform } from "../types";
import type {
  CanvasCommittedStructuralEvent,
  CanvasEventHandlers,
  CanvasInboundEvent,
  CanvasOutboundEvent,
} from "../../shared/events";
import {
  isCommittedStructuralInboundEvent,
} from "../../shared/events";
import { screenToWorld } from "../utils/coordinates";
import { COLLAB_WS_URL } from "../../shared/config/env";
import type { CursorPresenceStore } from "../presence/cursorPresenceStore";
import type { CollabUser, RemoteStroke } from "../presence/types";
import type { CanvasDocumentStore } from "../document/canvasDocumentStore";
import type { CanvasOperationQueueStore } from "../ops/canvasOperationQueueStore";
import {
  getNextDispatchableOperation,
  getPendingStructuralOperations,
} from "../ops/canvasOperationQueueStore";

const CURSOR_MOVE_UPDATE_INTERVAL = 17;

interface UseCanvasCollabArgs {
  canvasId: string;
  userId: string;
  displayName: string;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  transformRef: React.RefObject<Transform>;
  cursorStore: CursorPresenceStore;
  documentStore: CanvasDocumentStore;
  operationQueueStore: CanvasOperationQueueStore;
  handlers?: CanvasEventHandlers;
}

/**
 * Own the shared canvas WebSocket session and bridge transport events into the
 * document store, operation queue, and lightweight presence state.
 */
export function useCanvasCollab({
  canvasId,
  userId,
  displayName,
  viewportRef,
  transformRef,
  cursorStore,
  documentStore,
  operationQueueStore,
  handlers = {},
}: UseCanvasCollabArgs) {
  const [users, setUsers] = useState<CollabUser[]>([]);
  const [remoteStrokes, setRemoteStrokes] = useState<Map<string, RemoteStroke>>(
    new Map(),
  );
  const wsRef = useRef<WebSocket | null>(null);
  const lastCursorSentAt = useRef(0);
  const bufferedStructuralEventsRef = useRef<CanvasCommittedStructuralEvent[]>(
    [],
  );
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const send = useCallback(
    (event: CanvasOutboundEvent) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ ...event, canvasId, userId }));
    },
    [canvasId, userId],
  );

  const reconcileCommittedStructuralEvent = useCallback(
    (event: CanvasCommittedStructuralEvent) => {
      const isLocalAck = event.userId === userId;

      if (!isLocalAck && event.type === "node_move") {
        handlersRef.current.onNodeMove?.(
          event.userId,
          event.nodeId,
          event.x,
          event.y,
        );
      }

      if (isLocalAck) {
        operationQueueStore.getState().acknowledge(event.clientOperationId);
      }

      operationQueueStore.getState().pruneForCommittedEvent(event);
      documentStore.getState().rebaseOnCommittedOperation(
        event,
        getPendingStructuralOperations(operationQueueStore),
      );
    },
    [documentStore, operationQueueStore, userId],
  );

  const tryDispatchNextQueuedOperation = useCallback(() => {
    const next = getNextDispatchableOperation(operationQueueStore);
    if (!next) {
      return;
    }

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      ws.send(JSON.stringify({ ...next.event, canvasId, userId }));
      operationQueueStore.getState().markInFlight(next.clientOperationId);
    } catch (error) {
      console.error("Failed to dispatch queued structural operation", error);
      operationQueueStore.getState().setDispatchReady(false);
    }
  }, [canvasId, operationQueueStore, userId]);

  useEffect(() => {
    tryDispatchNextQueuedOperation();
    return operationQueueStore.subscribe(() => {
      tryDispatchNextQueuedOperation();
    });
  }, [operationQueueStore, tryDispatchNextQueuedOperation]);

  useEffect(() => {
    const ws = new WebSocket(COLLAB_WS_URL);

    ws.onopen = () => {
      setUsers([]);
      cursorStore.clear();
      setRemoteStrokes(new Map());
      bufferedStructuralEventsRef.current = [];
      operationQueueStore.getState().setDispatchReady(false);
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

      if (isCommittedStructuralInboundEvent(msg)) {
        if (!operationQueueStore.getState().dispatchReady) {
          bufferedStructuralEventsRef.current.push(msg);
          return;
        }
        reconcileCommittedStructuralEvent(msg);
        return;
      }

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

        case "canvas_bootstrap": {
          documentStore.getState().replaceFromBootstrap(
            msg.nodes,
            msg.edges,
            msg.headVersion,
            getPendingStructuralOperations(operationQueueStore),
          );

          const buffered = [...bufferedStructuralEventsRef.current].sort(
            (a, b) => a.version - b.version,
          );
          bufferedStructuralEventsRef.current = [];
          for (const bufferedEvent of buffered) {
            reconcileCommittedStructuralEvent(bufferedEvent);
          }
          operationQueueStore.getState().setDispatchReady(true);
          break;
        }

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
          if (msg.userId === userId) break;
          cursorStore.upsertCursor({
            userId: msg.userId,
            x: msg.x,
            y: msg.y,
          });
          break;

        case "node_drag_start":
          if (msg.userId === userId) break;
          handlersRef.current.onNodeDragStart?.(msg.userId, msg.nodeIds);
          break;

        case "node_drag_end":
          if (msg.userId === userId) break;
          handlersRef.current.onNodeDragEnd?.(msg.userId);
          break;

        case "node_select":
          if (msg.userId === userId) break;
          handlersRef.current.onNodeSelect?.(msg.userId, msg.nodeIds);
          break;

        case "draw_points":
          if (msg.userId === userId) break;
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
          if (msg.userId === userId) break;
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
          if (msg.userId === userId) break;
          handlersRef.current.onCrdtOp?.(msg.docId, msg.op, msg.userId);
          break;

        case "sync_response":
          handlersRef.current.onSyncResponse?.(msg.docId, msg.ops);
          break;
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;

      setUsers([]);
      cursorStore.clear();
      setRemoteStrokes(new Map());
      bufferedStructuralEventsRef.current = [];
      operationQueueStore.getState().setDispatchReady(false);
      operationQueueStore.getState().requeueInFlightOperations();
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    return () => {
      bufferedStructuralEventsRef.current = [];
      operationQueueStore.getState().setDispatchReady(false);
      operationQueueStore.getState().requeueInFlightOperations();
      cursorStore.clear();
      ws.close();
    };
  }, [
    canvasId,
    cursorStore,
    displayName,
    documentStore,
    operationQueueStore,
    reconcileCommittedStructuralEvent,
    userId,
  ]);

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

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject, SetStateAction } from "react";
import { useCanvasCrdt } from "../../shared/crdt/useCanvasCrdt";
import type { CrdtOp } from "../../shared/crdt";
import type {
  CanvasOutboundEvent,
  CanvasOutboundStructuralEvent,
} from "../../shared/events";
import {
  type CanvasNode,
  type NodeType,
  createCodeNode,
  createDrawNode,
  createNoteNode,
  createProblemNode,
  createTestResultsNode,
} from "../../shared/nodes";
import type { CanvasDocumentStore } from "../document/canvasDocumentStore";
import { useCanvasDocumentStore } from "../document/canvasDocumentStore";
import type { CanvasOperationQueueStore } from "../ops/canvasOperationQueueStore";
import type { Transform } from "../types";
import { screenToWorld } from "../utils/coordinates";

interface UseCanvasDocumentArgs {
  userId: string;
  viewportRef: RefObject<HTMLDivElement | null>;
  transformRef: RefObject<Transform>;
  sendRef: RefObject<((event: CanvasOutboundEvent) => void) | null>;
  documentStore: CanvasDocumentStore;
  operationQueueStore: CanvasOperationQueueStore;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported node type: ${String(value)}`);
}

function createNodeForType(type: NodeType, x: number, y: number): CanvasNode {
  switch (type) {
    case "note":
      return createNoteNode(x, y);
    case "problem":
      return createProblemNode(x, y);
    case "code":
      return createCodeNode(x, y);
    case "draw":
      return createDrawNode(x, y, 1, 1, [], 2);
    case "test-results":
      return createTestResultsNode(x, y);
    default:
      return assertNever(type);
  }
}

function cloneNodeData<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneCanvasNode(node: CanvasNode, dx: number, dy: number): CanvasNode {
  return {
    ...node,
    id: crypto.randomUUID(),
    x: node.x + dx,
    y: node.y + dy,
    data: cloneNodeData(node.data),
  } as CanvasNode;
}

/**
 * Bridge the canvas UI command surface onto the new document store + queue
 * architecture.
 *
 * Structural commands now optimistically project into the document store and
 * enqueue durable operations separately, while ephemeral selection/CRDT flows
 * still send immediately over the socket path.
 */
export function useCanvasDocument({
  userId,
  viewportRef,
  transformRef,
  sendRef,
  documentStore,
  operationQueueStore,
}: UseCanvasDocumentArgs) {
  const nodes = useCanvasDocumentStore(documentStore, (state) => state.nodes);
  const edges = useCanvasDocumentStore(documentStore, (state) => state.edges);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const nodesRef = useRef<CanvasNode[]>(nodes);

  useLayoutEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const sendEvent = useCallback(
    (event: CanvasOutboundEvent) => {
      sendRef.current?.(event);
    },
    [sendRef],
  );

  const setNodesWithRef = useCallback(
    (value: SetStateAction<CanvasNode[]>) => {
      documentStore.getState().setNodes(value);
    },
    [documentStore],
  );

  const {
    onTextEdits,
    onCrdtOp,
    onSyncResponse,
    onNodeDelete: onDeleteCrdtDoc,
  } = useCanvasCrdt({
    userId,
    nodes,
    setNodes: setNodesWithRef,
    sendRef,
  });

  const enqueueStructuralOperation = useCallback(
    (event: CanvasOutboundStructuralEvent) => {
      documentStore.getState().applyOptimisticOperation(event);
      operationQueueStore.getState().enqueue(event);
    },
    [documentStore, operationQueueStore],
  );

  const enqueueStructuralOperations = useCallback(
    (events: CanvasOutboundStructuralEvent[]) => {
      if (events.length === 0) {
        return;
      }
      documentStore.getState().applyOptimisticOperations(events);
      const queue = operationQueueStore.getState();
      for (const event of events) {
        queue.enqueue(event);
      }
    },
    [documentStore, operationQueueStore],
  );

  const updateNode = useCallback(
    (id: string, patch: Partial<CanvasNode>) => {
      enqueueStructuralOperation({
        type: "node_update",
        clientOperationId: crypto.randomUUID(),
        nodeId: id,
        patch,
      });
    },
    [enqueueStructuralOperation],
  );

  const moveNodes = useCallback(
    (moves: Array<{ id: string; x: number; y: number }>) => {
      enqueueStructuralOperations(
        moves.map((move) => ({
          type: "node_move" as const,
          clientOperationId: crypto.randomUUID(),
          nodeId: move.id,
          x: move.x,
          y: move.y,
        })),
      );
    },
    [enqueueStructuralOperations],
  );

  const resizeNode = useCallback(
    (id: string, width: number, height: number) => {
      enqueueStructuralOperation({
        type: "node_update",
        clientOperationId: crypto.randomUUID(),
        nodeId: id,
        patch: { width, height },
      });
    },
    [enqueueStructuralOperation],
  );

  const selectNodes = useCallback(
    (nodeIds: Set<string>) => {
      setSelectedNodeIds(nodeIds);
      sendEvent({ type: "node_select", userId, nodeIds: Array.from(nodeIds) });
    },
    [sendEvent, userId],
  );

  const clearSelection = useCallback(() => {
    selectNodes(new Set());
  }, [selectNodes]);

  const deleteNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeIds((prev) => {
        if (!prev.has(nodeId)) return prev;
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      onDeleteCrdtDoc(nodeId);
      enqueueStructuralOperation({
        type: "node_delete",
        clientOperationId: crypto.randomUUID(),
        nodeId,
      });
    },
    [enqueueStructuralOperation, onDeleteCrdtDoc],
  );

  const cloneNode = useCallback(
    (nodeId: string) => {
      const sourceNode = nodesRef.current.find((node) => node.id === nodeId);
      if (!sourceNode) return;

      const clonedNode = cloneCanvasNode(sourceNode, 24, 24);
      enqueueStructuralOperation({
        type: "node_create",
        clientOperationId: crypto.randomUUID(),
        node: clonedNode,
      });
      selectNodes(new Set([clonedNode.id]));
    },
    [enqueueStructuralOperation, selectNodes],
  );

  const pasteNodeFromSnapshot = useCallback(
    (sourceNode: CanvasNode) => {
      const pastedNode = cloneCanvasNode(sourceNode, 24, 24);
      enqueueStructuralOperation({
        type: "node_create",
        clientOperationId: crypto.randomUUID(),
        node: pastedNode,
      });
      selectNodes(new Set([pastedNode.id]));
    },
    [enqueueStructuralOperation, selectNodes],
  );

  const commitDrawStroke = useCallback(
    (points: Array<[number, number]>, strokeThickness: number) => {
      const padding = 4;
      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      const nodeX = minX - padding;
      const nodeY = minY - padding;
      const nodeW = Math.max(maxX - minX + 2 * padding, 1);
      const nodeH = Math.max(maxY - minY + 2 * padding, 1);
      const relativePoints = points.map(
        ([x, y]) => [x - nodeX, y - nodeY] as [number, number],
      );

      const node = createDrawNode(
        nodeX,
        nodeY,
        nodeW,
        nodeH,
        relativePoints,
        strokeThickness,
      );
      enqueueStructuralOperation({
        type: "node_create",
        clientOperationId: crypto.randomUUID(),
        node,
      });
      selectNodes(new Set([node.id]));
    },
    [enqueueStructuralOperation, selectNodes],
  );

  const spawnNode = useCallback(
    (type: NodeType, fromNodeId?: string): string | undefined => {
      const viewport = viewportRef.current;
      if (!viewport) return undefined;

      const rect = viewport.getBoundingClientRect();
      const world = screenToWorld(
        rect.width / 2,
        rect.height / 2,
        transformRef.current,
      );

      const node = createNodeForType(type, world.x, world.y);
      node.x = world.x - node.width / 2;
      node.y = world.y - node.height / 2;

      const operations: CanvasOutboundStructuralEvent[] = [
        {
          type: "node_create",
          clientOperationId: crypto.randomUUID(),
          node,
        },
      ];

      if (fromNodeId) {
        operations.push({
          type: "edge_create",
          clientOperationId: crypto.randomUUID(),
          edge: {
            id: crypto.randomUUID(),
            fromNodeId,
            toNodeId: node.id,
          },
        });
      }

      enqueueStructuralOperations(operations);
      selectNodes(new Set([node.id]));
      return node.id;
    },
    [enqueueStructuralOperations, selectNodes, transformRef, viewportRef],
  );

  const getNodeById = useCallback(
    (nodeId: string) => {
      return documentStore.getState().nodes.find((node) => node.id === nodeId);
    },
    [documentStore],
  );

  const remote = useMemo(
    () => ({
      applyCrdtOp: (docId: string, op: CrdtOp) => {
        onCrdtOp(docId, op);
      },
      applySyncResponse: (docId: string, ops: CrdtOp[]) => {
        onSyncResponse(docId, ops);
      },
    }),
    [onCrdtOp, onSyncResponse],
  );

  return {
    nodes,
    edges,
    selectedNodeIds,
    nodesRef,
    onTextEdits,
    getNodeById,
    commands: {
      updateNode,
      moveNodes,
      resizeNode,
      selectNodes,
      clearSelection,
      deleteNode,
      cloneNode,
      pasteNodeFromSnapshot,
      commitDrawStroke,
      spawnNode,
    },
    remote,
  };
}

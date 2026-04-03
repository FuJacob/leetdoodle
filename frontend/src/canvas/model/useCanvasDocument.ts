import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject, SetStateAction } from "react";
import { useCanvasCrdt } from "../../shared/crdt/useCanvasCrdt";
import type { CrdtOp } from "../../shared/crdt";
import type { CanvasOutboundEvent } from "../../shared/events";
import {
  type CanvasNode,
  type Edge,
  type NodeType,
  createCodeNode,
  createDrawNode,
  createNoteNode,
  createProblemNode,
  createTestResultsNode,
} from "../../shared/nodes";
import type { Transform } from "../types";
import { screenToWorld } from "../utils/coordinates";

interface UseCanvasDocumentArgs {
  userId: string;
  viewportRef: RefObject<HTMLDivElement | null>;
  transformRef: RefObject<Transform>;
  sendRef: RefObject<((event: CanvasOutboundEvent) => void) | null>;
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
 * Owns the local canvas document model: nodes, edges, selection, and document commands.
 *
 * This hook is the primary mutation boundary for canvas content. UI handlers,
 * draw tools, shortcuts, and remote collaboration events all funnel through
 * the command surface returned here instead of mutating canvas state inline.
 */
export function useCanvasDocument({
  userId,
  viewportRef,
  transformRef,
  sendRef,
}: UseCanvasDocumentArgs) {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const nodesRef = useRef<CanvasNode[]>(nodes);

  useLayoutEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const setNodesWithRef = useCallback(
    (value: SetStateAction<CanvasNode[]>) => {
      setNodes((prev) => {
        const next =
          typeof value === "function"
            ? (value as (prev: CanvasNode[]) => CanvasNode[])(prev)
            : value;
        nodesRef.current = next;
        return next;
      });
    },
    [],
  );

  const sendEvent = useCallback(
    (event: CanvasOutboundEvent) => {
      sendRef.current?.(event);
    },
    [sendRef],
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

  const updateNode = useCallback(
    (id: string, patch: Partial<CanvasNode>) => {
      setNodesWithRef((prev) =>
        prev.map((node) =>
          node.id === id ? ({ ...node, ...patch } as CanvasNode) : node,
        ),
      );
      sendEvent({ type: "node_update", nodeId: id, patch });
    },
    [sendEvent, setNodesWithRef],
  );

  const moveNodes = useCallback(
    (moves: Array<{ id: string; x: number; y: number }>) => {
      setNodesWithRef((prev) => {
        const moveMap = new Map(moves.map((move) => [move.id, move]));
        return prev.map((node) => {
          const move = moveMap.get(node.id);
          return move ? { ...node, x: move.x, y: move.y } : node;
        });
      });
      for (const move of moves) {
        sendEvent({ type: "node_move", nodeId: move.id, x: move.x, y: move.y });
      }
    },
    [sendEvent, setNodesWithRef],
  );

  const resizeNode = useCallback(
    (id: string, width: number, height: number) => {
      setNodesWithRef((prev) =>
        prev.map((node) =>
          node.id === id ? { ...node, width, height } : node,
        ),
      );
      sendEvent({ type: "node_update", nodeId: id, patch: { width, height } });
    },
    [sendEvent, setNodesWithRef],
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
      setNodesWithRef((prev) => prev.filter((node) => node.id !== nodeId));
      setEdges((prev) =>
        prev.filter(
          (edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId,
        ),
      );
      setSelectedNodeIds((prev) => {
        if (!prev.has(nodeId)) return prev;
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      onDeleteCrdtDoc(nodeId);
      sendEvent({ type: "node_delete", nodeId });
    },
    [onDeleteCrdtDoc, sendEvent, setNodesWithRef],
  );

  const cloneNode = useCallback(
    (nodeId: string) => {
      const sourceNode = nodesRef.current.find((node) => node.id === nodeId);
      if (!sourceNode) return;

      const clonedNode = cloneCanvasNode(sourceNode, 24, 24);
      setNodesWithRef((prev) => [...prev, clonedNode]);
      sendEvent({ type: "node_create", node: clonedNode });
      selectNodes(new Set([clonedNode.id]));
    },
    [selectNodes, sendEvent, setNodesWithRef],
  );

  const pasteNodeFromSnapshot = useCallback(
    (sourceNode: CanvasNode) => {
      const pastedNode = cloneCanvasNode(sourceNode, 24, 24);
      setNodesWithRef((prev) => [...prev, pastedNode]);
      sendEvent({ type: "node_create", node: pastedNode });
      selectNodes(new Set([pastedNode.id]));
    },
    [selectNodes, sendEvent, setNodesWithRef],
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
      const relativePoints = points.map(([x, y]) => [x - nodeX, y - nodeY] as [number, number]);

      const node = createDrawNode(
        nodeX,
        nodeY,
        nodeW,
        nodeH,
        relativePoints,
        strokeThickness,
      );
      setNodesWithRef((prev) => [...prev, node]);
      sendEvent({ type: "node_create", node });
      selectNodes(new Set([node.id]));
    },
    [selectNodes, sendEvent, setNodesWithRef],
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

      setNodesWithRef((prev) => [...prev, node]);
      sendEvent({ type: "node_create", node });
      selectNodes(new Set([node.id]));

      if (fromNodeId) {
        const edge: Edge = {
          id: crypto.randomUUID(),
          fromNodeId,
          toNodeId: node.id,
        };
        setEdges((prev) => [...prev, edge]);
        sendEvent({ type: "edge_create", edge });
      }

      return node.id;
    },
    [selectNodes, sendEvent, setNodesWithRef, transformRef, viewportRef],
  );

  const getNodeById = useCallback((nodeId: string) => {
    return nodesRef.current.find((node) => node.id === nodeId);
  }, []);

  const applyRemoteNodeCreate = useCallback(
    (node: CanvasNode) => {
      setNodesWithRef((prev) => [...prev, node]);
    },
    [setNodesWithRef],
  );

  const applyRemoteNodeMove = useCallback(
    (_userId: string, nodeId: string, x: number, y: number) => {
      setNodesWithRef((prev) =>
        prev.map((node) => (node.id === nodeId ? { ...node, x, y } : node)),
      );
    },
    [setNodesWithRef],
  );

  const applyRemoteNodeUpdate = useCallback(
    (nodeId: string, patch: Partial<CanvasNode>) => {
      setNodesWithRef((prev) =>
        prev.map((node) =>
          node.id === nodeId ? ({ ...node, ...patch } as CanvasNode) : node,
        ),
      );
    },
    [setNodesWithRef],
  );

  const applyRemoteNodeDelete = useCallback(
    (nodeId: string) => {
      setNodesWithRef((prev) => prev.filter((node) => node.id !== nodeId));
      setEdges((prev) =>
        prev.filter(
          (edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId,
        ),
      );
      setSelectedNodeIds((prev) => {
        if (!prev.has(nodeId)) return prev;
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      onDeleteCrdtDoc(nodeId);
    },
    [onDeleteCrdtDoc, setNodesWithRef],
  );

  const applyRemoteEdgeCreate = useCallback((edge: Edge) => {
    setEdges((prev) => [...prev, edge]);
  }, []);

  const applyRemoteEdgeDelete = useCallback((edgeId: string) => {
    setEdges((prev) => prev.filter((edge) => edge.id !== edgeId));
  }, []);

  const applyRemoteCrdtOp = useCallback(
    (docId: string, op: CrdtOp) => {
      onCrdtOp(docId, op);
    },
    [onCrdtOp],
  );

  const applyRemoteSyncResponse = useCallback(
    (docId: string, ops: CrdtOp[]) => {
      onSyncResponse(docId, ops);
    },
    [onSyncResponse],
  );

  const remote = useMemo(
    () => ({
      applyNodeCreate: applyRemoteNodeCreate,
      applyNodeMove: applyRemoteNodeMove,
      applyNodeUpdate: applyRemoteNodeUpdate,
      applyNodeDelete: applyRemoteNodeDelete,
      applyEdgeCreate: applyRemoteEdgeCreate,
      applyEdgeDelete: applyRemoteEdgeDelete,
      applyCrdtOp: applyRemoteCrdtOp,
      applySyncResponse: applyRemoteSyncResponse,
    }),
    [
      applyRemoteCrdtOp,
      applyRemoteEdgeCreate,
      applyRemoteEdgeDelete,
      applyRemoteNodeCreate,
      applyRemoteNodeDelete,
      applyRemoteNodeMove,
      applyRemoteNodeUpdate,
      applyRemoteSyncResponse,
    ],
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

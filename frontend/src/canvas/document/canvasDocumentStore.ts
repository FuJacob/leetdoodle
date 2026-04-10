import type { SetStateAction } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type {
  CanvasCommittedStructuralEvent,
  CanvasOutboundStructuralEvent,
} from "../../shared/events";
import type { CanvasNode, Edge } from "../../shared/nodes";

interface CanvasDocumentStoreState {
  baseNodes: CanvasNode[];
  baseEdges: Edge[];
  nodes: CanvasNode[];
  edges: Edge[];
  headVersion: number;
  replaceFromBootstrap: (
    nodes: CanvasNode[],
    edges: Edge[],
    headVersion: number,
    pendingOperations?: CanvasOutboundStructuralEvent[],
  ) => void;
  applyOptimisticOperation: (event: CanvasOutboundStructuralEvent) => void;
  applyOptimisticOperations: (
    events: CanvasOutboundStructuralEvent[],
  ) => void;
  rebaseOnCommittedOperation: (
    event: CanvasCommittedStructuralEvent,
    pendingOperations: CanvasOutboundStructuralEvent[],
  ) => void;
  setNodes: (value: SetStateAction<CanvasNode[]>) => void;
}

export type CanvasDocumentStore = ReturnType<typeof createCanvasDocumentStore>;

function upsertNode(nodes: CanvasNode[], node: CanvasNode): CanvasNode[] {
  const existingIndex = nodes.findIndex((candidate) => candidate.id === node.id);
  if (existingIndex === -1) {
    return [...nodes, node];
  }
  const next = [...nodes];
  next[existingIndex] = node;
  return next;
}

function upsertEdge(edges: Edge[], edge: Edge): Edge[] {
  const existingIndex = edges.findIndex((candidate) => candidate.id === edge.id);
  if (existingIndex === -1) {
    return [...edges, edge];
  }
  const next = [...edges];
  next[existingIndex] = edge;
  return next;
}

function removeNodeAndAttachedEdges(
  nodes: CanvasNode[],
  edges: Edge[],
  nodeId: string,
) {
  return {
    nodes: nodes.filter((node) => node.id !== nodeId),
    edges: edges.filter(
      (edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId,
    ),
  };
}

function applyStructuralOperation(
  nodes: CanvasNode[],
  edges: Edge[],
  event: CanvasOutboundStructuralEvent | CanvasCommittedStructuralEvent,
) {
  switch (event.type) {
    case "node_create":
      return { nodes: upsertNode(nodes, event.node), edges };

    case "node_move":
      return {
        nodes: nodes.map((node) =>
          node.id === event.nodeId
            ? { ...node, x: event.x, y: event.y }
            : node,
        ),
        edges,
      };

    case "node_update":
      return {
        nodes: nodes.map((node) =>
          node.id === event.nodeId
            ? ({ ...node, ...event.patch } as CanvasNode)
            : node,
        ),
        edges,
      };

    case "node_delete":
      return removeNodeAndAttachedEdges(nodes, edges, event.nodeId);

    case "edge_create":
      return { nodes, edges: upsertEdge(edges, event.edge) };

    case "edge_delete":
      return {
        nodes,
        edges: edges.filter((edge) => edge.id !== event.edgeId),
      };
  }
}

function replayPendingOperations(
  baseNodes: CanvasNode[],
  baseEdges: Edge[],
  pendingOperations: CanvasOutboundStructuralEvent[],
) {
  let projectedNodes = baseNodes;
  let projectedEdges = baseEdges;

  for (const operation of pendingOperations) {
    const next = applyStructuralOperation(
      projectedNodes,
      projectedEdges,
      operation,
    );
    projectedNodes = next.nodes;
    projectedEdges = next.edges;
  }

  return { projectedNodes, projectedEdges };
}

function syncBaseNodeContent(
  baseNodes: CanvasNode[],
  projectedNodes: CanvasNode[],
): CanvasNode[] {
  const projectedById = new Map(projectedNodes.map((node) => [node.id, node]));
  return baseNodes.map((baseNode) => {
    const projectedNode = projectedById.get(baseNode.id);
    if (!projectedNode) {
      return baseNode;
    }

    if (baseNode.type === "code" && projectedNode.type === "code") {
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          content: projectedNode.data.content,
          language: projectedNode.data.language,
        },
      };
    }

    if (baseNode.type === "note" && projectedNode.type === "note") {
      return {
        ...baseNode,
        data: {
          ...baseNode.data,
          content: projectedNode.data.content,
        },
      };
    }

    return baseNode;
  });
}

/**
 * Own durable canvas structure on the client as two layers:
 *
 * - base state: the last committed snapshot plus committed structural events
 * - projected state: base state with pending local operations replayed on top
 *
 * This keeps optimistic local edits responsive without letting remote committed
 * events permanently stomp over still-pending local intent.
 */
export function createCanvasDocumentStore() {
  return createStore<CanvasDocumentStoreState>((set) => ({
    baseNodes: [],
    baseEdges: [],
    nodes: [],
    edges: [],
    headVersion: 0,

    replaceFromBootstrap: (
      nodes,
      edges,
      headVersion,
      pendingOperations = [],
    ) => {
      const { projectedNodes, projectedEdges } = replayPendingOperations(
        nodes,
        edges,
        pendingOperations,
      );

      set({
        baseNodes: nodes,
        baseEdges: edges,
        nodes: projectedNodes,
        edges: projectedEdges,
        headVersion,
      });
    },

    applyOptimisticOperation: (event) =>
      set((state) => {
        const next = applyStructuralOperation(state.nodes, state.edges, event);
        return {
          nodes: next.nodes,
          edges: next.edges,
        };
      }),

    applyOptimisticOperations: (events) =>
      set((state) => {
        let nodes = state.nodes;
        let edges = state.edges;

        for (const event of events) {
          const next = applyStructuralOperation(nodes, edges, event);
          nodes = next.nodes;
          edges = next.edges;
        }

        return { nodes, edges };
      }),

    rebaseOnCommittedOperation: (event, pendingOperations) =>
      set((state) => {
        const rebased = applyStructuralOperation(
          state.baseNodes,
          state.baseEdges,
          event,
        );
        const { projectedNodes, projectedEdges } = replayPendingOperations(
          rebased.nodes,
          rebased.edges,
          pendingOperations,
        );

        return {
          baseNodes: rebased.nodes,
          baseEdges: rebased.edges,
          nodes: projectedNodes,
          edges: projectedEdges,
          headVersion: Math.max(state.headVersion, event.version),
        };
      }),

    setNodes: (value) =>
      set((state) => {
        const nextNodes =
          typeof value === "function"
            ? (value as (prev: CanvasNode[]) => CanvasNode[])(state.nodes)
            : value;
        return {
          nodes: nextNodes,
          baseNodes: syncBaseNodeContent(state.baseNodes, nextNodes),
        };
      }),
  }));
}

/**
 * Subscribe to one slice of a canvas document store from React.
 */
export function useCanvasDocumentStore<T>(
  store: CanvasDocumentStore,
  selector: (state: CanvasDocumentStoreState) => T,
): T {
  return useStore(store, selector);
}

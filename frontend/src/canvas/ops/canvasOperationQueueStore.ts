import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type {
  CanvasCommittedStructuralEvent,
  CanvasOutboundStructuralEvent,
} from "../../shared/events";

type OperationStatus = "pending" | "in_flight";

export interface CanvasQueuedOperation {
  clientOperationId: string;
  event: CanvasOutboundStructuralEvent;
  status: OperationStatus;
  attemptCount: number;
  createdAt: number;
}

interface CanvasOperationQueueState {
  operations: CanvasQueuedOperation[];
  dispatchReady: boolean;
  enqueue: (event: CanvasOutboundStructuralEvent) => void;
  markInFlight: (clientOperationId: string) => void;
  acknowledge: (clientOperationId: string) => void;
  setDispatchReady: (ready: boolean) => void;
  requeueInFlightOperations: () => void;
  pruneForCommittedEvent: (event: CanvasCommittedStructuralEvent) => void;
}

export type CanvasOperationQueueStore = ReturnType<
  typeof createCanvasOperationQueueStore
>;

function operationTouchesNode(
  operation: CanvasOutboundStructuralEvent,
  nodeId: string,
) {
  switch (operation.type) {
    case "node_create":
      return operation.node.id === nodeId;
    case "node_move":
    case "node_update":
    case "node_delete":
      return operation.nodeId === nodeId;
    case "edge_create":
      return (
        operation.edge.fromNodeId === nodeId || operation.edge.toNodeId === nodeId
      );
    case "edge_delete":
      return false;
  }
}

function operationTouchesEdge(
  operation: CanvasOutboundStructuralEvent,
  edgeId: string,
) {
  switch (operation.type) {
    case "edge_create":
      return operation.edge.id === edgeId;
    case "edge_delete":
      return operation.edgeId === edgeId;
    default:
      return false;
  }
}

/**
 * Own the client-side structural send queue.
 *
 * The queue is intentionally separate from the document store so optimistic UI
 * projection and transport/retry state do not collapse into one god store.
 */
export function createCanvasOperationQueueStore() {
  return createStore<CanvasOperationQueueState>((set) => ({
    operations: [],
    dispatchReady: false,

    enqueue: (event) =>
      set((state) => ({
        operations: [
          ...state.operations,
          {
            clientOperationId: event.clientOperationId,
            event,
            status: "pending",
            attemptCount: 0,
            createdAt: Date.now(),
          },
        ],
      })),

    markInFlight: (clientOperationId) =>
      set((state) => ({
        operations: state.operations.map((operation) =>
          operation.clientOperationId === clientOperationId
            ? {
                ...operation,
                status: "in_flight",
                attemptCount: operation.attemptCount + 1,
              }
            : operation,
        ),
      })),

    acknowledge: (clientOperationId) =>
      set((state) => ({
        operations: state.operations.filter(
          (operation) => operation.clientOperationId !== clientOperationId,
        ),
      })),

    setDispatchReady: (dispatchReady) => set({ dispatchReady }),

    requeueInFlightOperations: () =>
      set((state) => ({
        operations: state.operations.map((operation) =>
          operation.status === "in_flight"
            ? { ...operation, status: "pending" }
            : operation,
        ),
      })),

    pruneForCommittedEvent: (event) =>
      set((state) => ({
        operations: state.operations.filter((operation) => {
          switch (event.type) {
            case "node_delete":
              return !operationTouchesNode(operation.event, event.nodeId);
            case "edge_delete":
              return !operationTouchesEdge(operation.event, event.edgeId);
            default:
              return true;
          }
        }),
      })),
  }));
}

/**
 * Subscribe to one slice of a structural operation queue store from React.
 */
export function useCanvasOperationQueueStore<T>(
  store: CanvasOperationQueueStore,
  selector: (state: CanvasOperationQueueState) => T,
): T {
  return useStore(store, selector);
}

/**
 * Read all still-pending local structural operations in FIFO order.
 *
 * Both pending and in-flight operations count as local intent that should be
 * replayed on top of committed base state.
 */
export function getPendingStructuralOperations(
  store: CanvasOperationQueueStore,
): CanvasOutboundStructuralEvent[] {
  return store.getState().operations.map((operation) => operation.event);
}

/**
 * Return the next operation that can be dispatched right now, if any.
 */
export function getNextDispatchableOperation(
  store: CanvasOperationQueueStore,
): CanvasQueuedOperation | null {
  const state = store.getState();
  if (!state.dispatchReady) {
    return null;
  }

  if (state.operations.some((operation) => operation.status === "in_flight")) {
    return null;
  }

  return (
    state.operations.find((operation) => operation.status === "pending") ?? null
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CanvasNode,
  type Edge,
  type NodeType,
  createNoteNode,
  createProblemNode,
  createCodeNode,
  createDrawNode,
  createTestResultsNode,
} from "../shared/nodes";
import type { CanvasOutboundEvent } from "../shared/events";
import { useCanvasCrdt } from "../shared/crdt/useCanvasCrdt";
import { useCanvasTransform } from "./hooks/useCanvasTransform";
import { useNodeDrag } from "./hooks/useNodeDrag";
import { useCanvasCollab } from "./hooks/useCanvasCollab";
import { screenToWorld } from "./utils/coordinates";
import { NodeRenderer } from "./NodeRenderer";
import { CursorOverlay } from "./CursorOverlay";
import { DrawingOverlay } from "./DrawingOverlay";
import { EdgesOverlay } from "./EdgesOverlay";
import { SelectionOverlay } from "./SelectionOverlay";
import { CanvasPresenceBar } from "./CanvasPresenceBar";
import { SpawnPanel } from "./SpawnPanel";
import { ToolPanel } from "./ToolPanel";
import { ThemePanel } from "./ThemePanel";
import { useSelectToolController } from "./tools/useSelectToolController";
import { useDrawToolController } from "../features/draw/hooks/useDrawToolController";
import { useActiveToolController } from "./tools/useActiveToolController";
import type { CanvasTool } from "./tools/types";
import type { LocalCursorMode } from "./types";

interface CanvasProps {
  canvasId: string;
  userId: string;
}

function assertNever(x: never): never {
  throw new Error(`Unsupported node type: ${String(x)}`);
}

function spawnNode(type: NodeType, x: number, y: number): CanvasNode {
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

export function Canvas({ canvasId, userId }: CanvasProps) {
  const GRID_SPACING = 32;
  const GRID_DOT_RADIUS = 1.35;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [remoteSelections, setRemoteSelections] = useState<Map<string, string>>(
    new Map(),
  );
  const sendRef = useRef<((event: CanvasOutboundEvent) => void) | null>(null);

  const {
    transform,
    transformRef,
    onPointerDown: panPointerDown,
    onPointerMove: panPointerMove,
    onPointerUp: panPointerUp,
  } = useCanvasTransform(viewportRef);

  const {
    onTextEdits,
    onCrdtOp,
    onSyncResponse,
    onNodeDelete: onDeleteCrdtDoc,
  } = useCanvasCrdt({
    userId,
    nodes,
    setNodes,
    sendRef,
  });

  // Drawing tool state
  const [tool, setTool] = useState<CanvasTool>("select");
  const [thickness, setThickness] = useState(2);
  const [localCursorMode, setLocalCursorMode] =
    useState<LocalCursorMode>("pointer");

  // Collab hook with event handlers for remote updates
  const {
    cursors,
    users,
    remoteStrokes,
    send,
    onPointerMove: collabPointerMove,
  } = useCanvasCollab(canvasId, userId, viewportRef, transformRef, {
    onNodeCreate: (node) => {
      setNodes((prev) => [...prev, node]);
    },
    onNodeMove: (nodeId, x, y) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
      );
    },
    onNodeUpdate: (nodeId, patch) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? ({ ...n, ...patch } as CanvasNode) : n,
        ),
      );
    },
    onNodeDelete: (nodeId) => {
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setEdges((prev) =>
        prev.filter((e) => e.fromNodeId !== nodeId && e.toNodeId !== nodeId),
      );
      setSelectedNodeId((prev) => (prev === nodeId ? null : prev));
      onDeleteCrdtDoc(nodeId);
    },
    onEdgeCreate: (edge) => {
      setEdges((prev) => [...prev, edge]);
    },
    onEdgeDelete: (edgeId) => {
      setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    },
    onNodeSelect: (remoteUserId, nodeId) => {
      setRemoteSelections((prev) => {
        const next = new Map(prev);
        if (nodeId === null) {
          next.delete(remoteUserId);
        } else {
          next.set(remoteUserId, nodeId);
        }
        return next;
      });
    },
    onUserLeave: (remoteUserId) => {
      setRemoteSelections((prev) => {
        const next = new Map(prev);
        next.delete(remoteUserId);
        return next;
      });
    },
    onCrdtOp: (docId, op) => {
      onCrdtOp(docId, op);
    },
    onSyncResponse: (docId, ops) => {
      onSyncResponse(docId, ops);
    },
  });

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Update node locally + broadcast to others
  const updateNode = useCallback(
    (id: string, patch: Partial<CanvasNode>) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? ({ ...n, ...patch } as CanvasNode) : n)),
      );
      send({ type: "node_update", nodeId: id, patch });
    },
    [send],
  );

  // Move node locally + broadcast — called by drag hook
  const moveNode = useCallback(
    (id: string, x: number, y: number) => {
      setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
      send({ type: "node_move", nodeId: id, x, y });
    },
    [send],
  );

  // Resize node locally + broadcast — called by selection overlay
  const resizeNode = useCallback(
    (id: string, width: number, height: number) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, width, height } : n)),
      );
      send({ type: "node_update", nodeId: id, patch: { width, height } });
    },
    [send],
  );

  // Select node locally + broadcast
  const selectNode = useCallback(
    (nodeId: string | null) => {
      setSelectedNodeId(nodeId);
      send({ type: "node_select", userId, nodeId });
    },
    [send, userId],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((prev) => prev.filter((node) => node.id !== nodeId));
      setEdges((prev) =>
        prev.filter((edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId),
      );
      if (selectedNodeId === nodeId) {
        selectNode(null);
      }
      onDeleteCrdtDoc(nodeId);
      send({ type: "node_delete", nodeId });
    },
    [onDeleteCrdtDoc, selectedNodeId, selectNode, send],
  );

  const cloneNode = useCallback(
    (nodeId: string) => {
      const sourceNode = nodes.find((node) => node.id === nodeId);
      if (!sourceNode) return;

      const clonedNode = cloneCanvasNode(sourceNode, 24, 24);
      setNodes((prev) => [...prev, clonedNode]);
      send({ type: "node_create", node: clonedNode });
      selectNode(clonedNode.id);
    },
    [nodes, send, selectNode],
  );

  const {
    onNodePointerDown: dragPointerDown,
    onPointerMove: dragPointerMove,
    onPointerUp: dragPointerUp,
  } = useNodeDrag(transformRef, moveNode);

  const commitDrawStroke = useCallback(
    (pts: Array<[number, number]>, strokeThickness: number) => {
      const PADDING = 4;
      const xs = pts.map(([x]) => x);
      const ys = pts.map(([, y]) => y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      const nodeX = minX - PADDING;
      const nodeY = minY - PADDING;
      const nodeW = Math.max(maxX - minX + 2 * PADDING, 1);
      const nodeH = Math.max(maxY - minY + 2 * PADDING, 1);
      const relPts: Array<[number, number]> = pts.map(([x, y]) => [
        x - nodeX,
        y - nodeY,
      ]);

      const node = createDrawNode(
        nodeX,
        nodeY,
        nodeW,
        nodeH,
        relPts,
        strokeThickness,
      );
      setNodes((prev) => [...prev, node]);
      send({ type: "node_create", node });
      selectNode(node.id);
    },
    [send, selectNode],
  );

  const selectToolController = useSelectToolController({
    selectNode,
    panPointerDown,
    panPointerMove,
    panPointerUp,
    dragPointerDown,
    dragPointerMove,
    dragPointerUp,
    collabPointerMove,
  });

  const drawToolController = useDrawToolController({
    viewportRef,
    transformRef,
    send,
    collabPointerMove,
    thickness,
    onCommitStroke: commitDrawStroke,
  });

  const activeToolController = useActiveToolController(
    tool,
    selectToolController,
    drawToolController,
  );

  const handleSpawn = useCallback(
    (type: NodeType, fromNodeId?: string): string | undefined => {
      const el = viewportRef.current;
      if (!el) return undefined;
      const rect = el.getBoundingClientRect();
      const world = screenToWorld(
        rect.width / 2,
        rect.height / 2,
        transformRef.current,
      );
      const node = spawnNode(type, world.x, world.y);
      node.x = world.x - node.width / 2;
      node.y = world.y - node.height / 2;

      // Optimistic: apply locally first
      setNodes((prev) => [...prev, node]);
      send({ type: "node_create", node });

      // Select the newly created node
      selectNode(node.id);

      if (fromNodeId) {
        const edge: Edge = {
          id: crypto.randomUUID(),
          fromNodeId,
          toNodeId: node.id,
        };
        setEdges((prev) => [...prev, edge]);
        send({ type: "edge_create", edge });
      }

      return node.id;
    },
    [transformRef, send, selectNode],
  );

  const gridSpacingPx = Math.max(4, GRID_SPACING * transform.zoom);
  const gridDotRadiusPx = Math.max(0.7, GRID_DOT_RADIUS * transform.zoom);

  return (
    <div
      ref={viewportRef}
      className="fixed inset-0 overflow-hidden bg-(--lc-canvas-bg)"
      style={{
        backgroundImage: `radial-gradient(circle, var(--lc-canvas-dot) ${gridDotRadiusPx}px, transparent ${gridDotRadiusPx}px)`,
        backgroundSize: `${gridSpacingPx}px ${gridSpacingPx}px`,
        backgroundPosition: `${transform.x}px ${transform.y}px`,
      }}
      onPointerDown={activeToolController.onCanvasPointerDown}
      onPointerMove={activeToolController.onCanvasPointerMove}
      onPointerUp={activeToolController.onCanvasPointerUp}
    >
      <div className="absolute right-4 top-4 z-60 flex items-start gap-3">
        <CanvasPresenceBar users={users} localUserId={userId} />
        <ThemePanel />
        <ToolPanel
          tool={tool}
          onToolChange={setTool}
          thickness={thickness}
          onThicknessChange={setThickness}
        />
        {tool === "select" && <SpawnPanel onSpawn={handleSpawn} />}
      </div>

      {activeToolController.layers}

      <CursorOverlay
        cursors={cursors}
        users={users}
        transform={transform}
        viewportRef={viewportRef}
        localCursorMode={localCursorMode}
      />
      <DrawingOverlay remoteStrokes={remoteStrokes} users={users} transform={transform} />
      <EdgesOverlay nodes={nodes} edges={edges} transform={transform} />
      <SelectionOverlay
        nodes={nodes}
        selectedNodeId={selectedNodeId}
        remoteSelections={remoteSelections}
        users={users}
        transform={transform}
        onResize={resizeNode}
        onDelete={deleteNode}
        onClone={cloneNode}
        onLocalCursorModeChange={setLocalCursorMode}
      />

      <div
        className="absolute left-0 top-0 z-10"
        style={{
          transformOrigin: "0 0",
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
          width: 0,
          height: 0,
        }}
      >
        {nodes.map((node) => (
          <NodeRenderer
            key={node.id}
            node={node}
            nodes={nodes}
            edges={edges}
            onPointerDown={activeToolController.onNodePointerDown}
            onUpdate={updateNode}
            onSpawn={handleSpawn}
            onTextEdits={onTextEdits}
          />
        ))}
      </div>
    </div>
  );
}

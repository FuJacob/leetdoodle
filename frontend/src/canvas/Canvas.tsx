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

export function Canvas({ canvasId, userId }: CanvasProps) {
  const GRID_SPACING = 32;
  const GRID_DOT_RADIUS = 1;
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
  const [tool, setTool] = useState<"select" | "draw">("select");
  const [thickness, setThickness] = useState(2);
  // Refs for imperative drawing — avoids re-rendering Canvas on every pointer move
  const isDrawingRef = useRef(false);
  const allDrawPointsRef = useRef<Array<[number, number]>>([]);
  const pendingDrawPointsRef = useRef<Array<[number, number]>>([]);
  const lastDrawFlushRef = useRef(0);
  // Direct SVG manipulation for local stroke preview — no React state needed
  const localPolylineRef = useRef<SVGPolylineElement | null>(null);
  // Keep a ref to thickness so drawing handlers don't need to re-create on change
  const thicknessRef = useRef(thickness);
  useEffect(() => { thicknessRef.current = thickness; }, [thickness]);

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

  const {
    onNodePointerDown: dragPointerDown,
    onPointerMove: dragPointerMove,
    onPointerUp: dragPointerUp,
  } = useNodeDrag(transformRef, moveNode);

  // Wrap node pointer down to also select the node
  const onNodePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => {
      selectNode(node.id);
      dragPointerDown(e, node);
    },
    [selectNode, dragPointerDown],
  );

  // Handle canvas background click — deselect
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only deselect if clicking the canvas itself, not a node
      if (e.target === e.currentTarget) {
        selectNode(null);
      }
      panPointerDown(e);
    },
    [selectNode, panPointerDown],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      panPointerMove(e);
      dragPointerMove(e);
      collabPointerMove(e);
    },
    [panPointerMove, dragPointerMove, collabPointerMove],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      panPointerUp(e);
      dragPointerUp();
    },
    [panPointerUp, dragPointerUp],
  );

  // ---------------------------------------------------------------------------
  // Drawing handlers — only active when tool === "draw"
  //
  // We use imperative SVG manipulation for the local stroke preview so that
  // pointer-move updates never trigger a React re-render. All points are kept
  // in refs; only the final commit creates React state (a new DrawNode).
  // ---------------------------------------------------------------------------

  const updateLocalPolyline = useCallback(() => {
    const el = localPolylineRef.current;
    if (!el) return;
    const t = transformRef.current;
    const pts = allDrawPointsRef.current
      .map(([x, y]) => `${x * t.zoom + t.x},${y * t.zoom + t.y}`)
      .join(" ");
    el.setAttribute("points", pts);
  }, [transformRef]);

  const handleDrawPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Capture so we keep receiving events if the pointer leaves the element
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      allDrawPointsRef.current = [];
      pendingDrawPointsRef.current = [];

      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { x, y } = screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top,
        transformRef.current,
      );
      const pt: [number, number] = [x, y];
      allDrawPointsRef.current.push(pt);
      pendingDrawPointsRef.current.push(pt);
      updateLocalPolyline();
    },
    [transformRef, viewportRef, updateLocalPolyline],
  );

  const handleDrawPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDrawingRef.current) return;
      collabPointerMove(e); // keep cursor position up to date for peers

      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { x, y } = screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top,
        transformRef.current,
      );
      const pt: [number, number] = [x, y];
      allDrawPointsRef.current.push(pt);
      pendingDrawPointsRef.current.push(pt);
      updateLocalPolyline();

      // Flush accumulated points to peers at ~60fps
      const now = performance.now();
      if (now - lastDrawFlushRef.current >= 16 && pendingDrawPointsRef.current.length > 0) {
        lastDrawFlushRef.current = now;
        const batch = pendingDrawPointsRef.current.splice(0);
        send({ type: "draw_points", points: batch });
      }
    },
    [transformRef, viewportRef, collabPointerMove, updateLocalPolyline, send],
  );

  const handleDrawPointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    // Flush any remaining buffered points
    if (pendingDrawPointsRef.current.length > 0) {
      send({ type: "draw_points", points: pendingDrawPointsRef.current.splice(0) });
    }
    send({ type: "draw_end" });

    // Clear local preview
    localPolylineRef.current?.setAttribute("points", "");

    // Commit: normalize bounding box so node.x/y/width/height tightly wrap the stroke
    const pts = allDrawPointsRef.current;
    if (pts.length < 2) return;

    const PADDING = 4; // small visual breathing room around the stroke
    const xs = pts.map(([px]) => px);
    const ys = pts.map(([, py]) => py);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    const nodeX = minX - PADDING;
    const nodeY = minY - PADDING;
    const nodeW = Math.max(maxX - minX + 2 * PADDING, 1);
    const nodeH = Math.max(maxY - minY + 2 * PADDING, 1);

    // Points become relative to the node's top-left corner
    const relPts: Array<[number, number]> = pts.map(([px, py]) => [
      px - nodeX,
      py - nodeY,
    ]);

    const node = createDrawNode(nodeX, nodeY, nodeW, nodeH, relPts, thicknessRef.current);
    setNodes((prev) => [...prev, node]);
    send({ type: "node_create", node });
    selectNode(node.id);
  }, [send, selectNode]);

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
  const gridDotRadiusPx = Math.max(0.4, GRID_DOT_RADIUS * transform.zoom);

  return (
    <div
      ref={viewportRef}
      className="fixed inset-0 overflow-hidden bg-zinc-950"
      style={{
        backgroundImage: `radial-gradient(circle, var(--color-zinc-700) ${gridDotRadiusPx}px, transparent ${gridDotRadiusPx}px)`,
        backgroundSize: `${gridSpacingPx}px ${gridSpacingPx}px`,
        backgroundPosition: `${transform.x}px ${transform.y}px`,
      }}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="absolute right-4 top-4 z-60 flex items-start gap-3">
        <CanvasPresenceBar users={users} localUserId={userId} />
        <ToolPanel
          tool={tool}
          onToolChange={setTool}
          thickness={thickness}
          onThicknessChange={setThickness}
        />
        {tool === "select" && <SpawnPanel onSpawn={handleSpawn} />}
      </div>

      {/* Local stroke preview — updated imperatively, no React re-renders during drawing */}
      <svg
        className="pointer-events-none absolute inset-0 z-25"
        style={{ width: "100%", height: "100%" }}
      >
        <polyline
          ref={localPolylineRef}
          fill="none"
          stroke="white"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Transparent capture layer — sits on top of everything when draw tool is active */}
      {tool === "draw" && (
        <div
          className="absolute inset-0 z-50 cursor-crosshair"
          onPointerDown={handleDrawPointerDown}
          onPointerMove={handleDrawPointerMove}
          onPointerUp={handleDrawPointerUp}
        />
      )}

      <CursorOverlay cursors={cursors} users={users} transform={transform} />
      <DrawingOverlay remoteStrokes={remoteStrokes} users={users} transform={transform} />
      <EdgesOverlay nodes={nodes} edges={edges} transform={transform} />
      <SelectionOverlay
        nodes={nodes}
        selectedNodeId={selectedNodeId}
        remoteSelections={remoteSelections}
        users={users}
        transform={transform}
        onResize={resizeNode}
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
            onPointerDown={onNodePointerDown}
            onUpdate={updateNode}
            onSpawn={handleSpawn}
            onTextEdits={onTextEdits}
          />
        ))}
      </div>
    </div>
  );
}

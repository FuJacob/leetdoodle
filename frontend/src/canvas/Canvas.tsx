import { useEffect, useMemo, useRef, useState } from "react";
import type { CanvasOutboundEvent } from "../shared/events";
import { useCanvasTransform } from "./hooks/useCanvasTransform";
import { useNodeDrag } from "./hooks/useNodeDrag";
import { useCanvasCollab } from "./hooks/useCanvasCollab";
import { NodeRenderer } from "./NodeRenderer";
import { CursorOverlay } from "./CursorOverlay";
import { DrawingOverlay } from "./DrawingOverlay";
import { EdgesOverlay } from "./EdgesOverlay";
import { SelectionOverlay } from "./SelectionOverlay";
import { CanvasPresenceBar } from "./CanvasPresenceBar";
import { SpawnPanel } from "./SpawnPanel";
import { ToolPanel } from "./ToolPanel";
import { ThemePanel } from "./ThemePanel";
import { ZoomPanel } from "./ZoomPanel";
import { useSelectToolController } from "./tools/useSelectToolController";
import { useDrawToolController } from "../features/draw/hooks/useDrawToolController";
import { useActiveToolController } from "./tools/useActiveToolController";
import type { CanvasTool } from "./tools/types";
import type { LocalCursorMode } from "./types";
import { useCanvasShortcutContainer } from "./shortcuts/useCanvasShortcutContainer";
import type { NodeDragVisual } from "./dragVisuals";
import { useCanvasDocument } from "./model/useCanvasDocument";

interface CanvasProps {
  canvasId: string;
  userId: string;
  displayName: string;
}

const LOCAL_DRAG_COLOR_FALLBACK = "#3b82f6";
const REMOTE_DRAG_COLOR_FALLBACK = "#f97316";

interface ActiveNodeDragState {
  userId: string;
  nodeIds: string[];
  dx: number;
  dy: number;
}

export function Canvas({ canvasId, userId, displayName }: CanvasProps) {
  console.log("Rendering Canvas", { canvasId, userId, displayName });
  const GRID_SPACING = 32;
  const GRID_DOT_RADIUS = 1.35;
  const viewportRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<((event: CanvasOutboundEvent) => void) | null>(null);
  const [remoteSelections, setRemoteSelections] = useState<
    Map<string, Set<string>>
  >(new Map());
  const [localDragState, setLocalDragState] =
    useState<ActiveNodeDragState | null>(null);
  const [remoteDragStates, setRemoteDragStates] = useState<
    Map<string, ActiveNodeDragState>
  >(new Map());

  const {
    transform,
    transformRef,
    onPointerDown: panPointerDown,
    onPointerMove: panPointerMove,
    onPointerUp: panPointerUp,
    onPointerCancel: panPointerCancel,
    zoomIn,
    zoomOut,
    cancelPan,
  } = useCanvasTransform(viewportRef);

  const {
    nodes,
    edges,
    selectedNodeIds,
    nodesRef,
    onTextEdits,
    getNodeById,
    commands,
    remote,
  } = useCanvasDocument({
    userId,
    viewportRef,
    transformRef,
    sendRef,
  });

  const [tool, setTool] = useState<CanvasTool>("select");
  const [thickness, setThickness] = useState(2);
  const [localCursorMode, setLocalCursorMode] =
    useState<LocalCursorMode>("pointer");

  const collabHandlers = useMemo(
    () => ({
      onNodeCreate: remote.applyNodeCreate,
      onNodeMove: (
        remoteUserId: string,
        nodeId: string,
        x: number,
        y: number,
      ) => {
        const previousNode = getNodeById(nodeId);
        remote.applyNodeMove(remoteUserId, nodeId, x, y);
        if (!previousNode) return;

        setRemoteDragStates((prev) => {
          const dragState = prev.get(remoteUserId);
          if (!dragState || !dragState.nodeIds.includes(nodeId)) {
            return prev;
          }

          const next = new Map(prev);
          next.set(remoteUserId, {
            ...dragState,
            dx: x - previousNode.x,
            dy: y - previousNode.y,
          });
          return next;
        });
      },
      onNodeDragStart: (remoteUserId: string, nodeIds: string[]) => {
        setRemoteDragStates((prev) => {
          const next = new Map(prev);
          next.set(remoteUserId, {
            userId: remoteUserId,
            nodeIds,
            dx: 0,
            dy: 0,
          });
          return next;
        });
      },
      onNodeDragEnd: (remoteUserId: string) => {
        setRemoteDragStates((prev) => {
          const next = new Map(prev);
          next.delete(remoteUserId);
          return next;
        });
      },
      onNodeUpdate: remote.applyNodeUpdate,
      onNodeDelete: remote.applyNodeDelete,
      onEdgeCreate: remote.applyEdgeCreate,
      onEdgeDelete: remote.applyEdgeDelete,
      onNodeSelect: (remoteUserId: string, nodeIds: string[]) => {
        setRemoteSelections((prev) => {
          const next = new Map(prev);
          if (nodeIds.length === 0) {
            next.delete(remoteUserId);
          } else {
            next.set(remoteUserId, new Set(nodeIds));
          }
          return next;
        });
      },
      onUserLeave: (remoteUserId: string) => {
        setRemoteSelections((prev) => {
          const next = new Map(prev);
          next.delete(remoteUserId);
          return next;
        });
        setRemoteDragStates((prev) => {
          const next = new Map(prev);
          next.delete(remoteUserId);
          return next;
        });
      },
      onCrdtOp: remote.applyCrdtOp,
      onSyncResponse: remote.applySyncResponse,
    }),
    [getNodeById, remote],
  );

  const {
    cursors,
    users,
    remoteStrokes,
    send,
    onPointerMove: collabPointerMove,
  } = useCanvasCollab(
    canvasId,
    userId,
    displayName,
    viewportRef,
    transformRef,
    collabHandlers,
  );

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const {
    onNodePointerDown: dragPointerDown,
    onPointerMove: dragPointerMove,
    onPointerUp: dragPointerUp,
  } = useNodeDrag(transformRef, commands.moveNodes, selectedNodeIds, nodesRef, {
    onDragStart: (nodeIds) => {
      setLocalDragState({
        userId,
        nodeIds,
        dx: 0,
        dy: 0,
      });
      send({ type: "node_drag_start", nodeIds });
    },
    onDragUpdate: ({ nodeIds, dx, dy }) => {
      setLocalDragState({
        userId,
        nodeIds,
        dx,
        dy,
      });
    },
    onDragEnd: () => {
      setLocalDragState(null);
      send({ type: "node_drag_end" });
    },
  });

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user] as const)),
    [users],
  );

  const nodeDragVisuals = useMemo(() => {
    const visuals = new Map<string, NodeDragVisual>();

    if (localDragState) {
      const color =
        usersById.get(localDragState.userId)?.color ??
        LOCAL_DRAG_COLOR_FALLBACK;
      for (const nodeId of localDragState.nodeIds) {
        visuals.set(nodeId, {
          dx: localDragState.dx,
          dy: localDragState.dy,
          color,
          isLocal: true,
        });
      }
    }

    for (const [remoteUserId, dragState] of remoteDragStates) {
      const color =
        usersById.get(remoteUserId)?.color ?? REMOTE_DRAG_COLOR_FALLBACK;
      for (const nodeId of dragState.nodeIds) {
        if (visuals.has(nodeId)) continue;
        visuals.set(nodeId, {
          dx: dragState.dx,
          dy: dragState.dy,
          color,
          isLocal: false,
        });
      }
    }

    return visuals;
  }, [localDragState, remoteDragStates, usersById]);

  const selectToolController = useSelectToolController({
    selectNodes: commands.selectNodes,
    dragPointerDown,
    dragPointerMove,
    dragPointerUp,
    collabPointerMove,
    viewportRef,
    transform,
    transformRef,
    nodesRef,
    selectedNodeIds,
  });

  const drawToolController = useDrawToolController({
    viewportRef,
    transformRef,
    send,
    collabPointerMove,
    thickness,
    onCommitStroke: commands.commitDrawStroke,
  });

  const activeToolController = useActiveToolController(
    tool,
    selectToolController,
    drawToolController,
  );

  const {
    isSpacePanning,
    onSpacePanPointerDown,
    onSpacePanPointerMove,
    onSpacePanPointerUp,
    onSpacePanPointerCancel,
  } = useCanvasShortcutContainer({
    viewportRef,
    nodesRef,
    selectedNodeIds,
    tool,
    setTool,
    selectNodes: commands.selectNodes,
    deleteNode: commands.deleteNode,
    cloneNode: commands.cloneNode,
    pasteNodeFromSnapshot: commands.pasteNodeFromSnapshot,
    panPointerDown,
    panPointerMove,
    panPointerUp,
    panPointerCancel,
    cancelPan,
    collabPointerMove,
    onLocalCursorModeChange: setLocalCursorMode,
    zoomIn,
    zoomOut,
  });

  const gridSpacingPx = Math.max(4, GRID_SPACING * transform.zoom);
  const gridDotRadiusPx = Math.max(0.7, GRID_DOT_RADIUS * transform.zoom);

  return (
    <div
      ref={viewportRef}
      className="lc-canvas-cursorless fixed inset-0 overflow-hidden bg-(--lc-canvas-bg)"
      style={{
        backgroundImage: `radial-gradient(circle, var(--lc-canvas-dot) ${gridDotRadiusPx}px, transparent ${gridDotRadiusPx}px)`,
        backgroundSize: `${gridSpacingPx}px ${gridSpacingPx}px`,
        backgroundPosition: `${transform.x}px ${transform.y}px`,
      }}
      onPointerDown={activeToolController.onCanvasPointerDown}
      onPointerMove={activeToolController.onCanvasPointerMove}
      onPointerUp={activeToolController.onCanvasPointerUp}
    >
      <div className="absolute right-4 top-4 z-60 flex select-none items-start gap-3">
        <CanvasPresenceBar users={users} localUserId={userId} />
        <ZoomPanel
          zoom={transform.zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
        />
        <ThemePanel />
        <ToolPanel
          tool={tool}
          onToolChange={setTool}
          thickness={thickness}
          onThicknessChange={setThickness}
        />
        {tool === "select" && <SpawnPanel onSpawn={commands.spawnNode} />}
      </div>

      {isSpacePanning && (
        <div
          className="absolute inset-0 z-400 cursor-grab active:cursor-grabbing"
          onPointerDown={onSpacePanPointerDown}
          onPointerMove={onSpacePanPointerMove}
          onPointerUp={onSpacePanPointerUp}
          onPointerCancel={onSpacePanPointerCancel}
        />
      )}

      {activeToolController.layers}

      <CursorOverlay
        cursors={cursors}
        users={users}
        transform={transform}
        viewportRef={viewportRef}
        localCursorMode={localCursorMode}
      />
      <DrawingOverlay
        remoteStrokes={remoteStrokes}
        users={users}
        transform={transform}
      />
      <EdgesOverlay nodes={nodes} edges={edges} transform={transform} />
      <SelectionOverlay
        nodes={nodes}
        selectedNodeIds={selectedNodeIds}
        remoteSelections={remoteSelections}
        users={users}
        transform={transform}
        onResize={commands.resizeNode}
        onDelete={commands.deleteNode}
        onClone={commands.cloneNode}
        onSpawn={commands.spawnNode}
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
            onUpdate={commands.updateNode}
            onSpawn={commands.spawnNode}
            onTextEdits={onTextEdits}
            dragVisual={nodeDragVisuals.get(node.id)}
          />
        ))}
      </div>
    </div>
  );
}

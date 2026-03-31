import { useCallback, useMemo, useRef } from "react";
import type { CanvasNode } from "../shared/nodes";
import type { CollabUser } from "./hooks/useCanvasCollab";
import type { Transform } from "./types";

interface Props {
  nodes: CanvasNode[];
  selectedNodeId: string | null;
  remoteSelections: Map<string, string>; // userId → nodeId
  users: CollabUser[];
  transform: Transform;
  onResize: (nodeId: string, width: number, height: number) => void;
}

type Corner = "nw" | "ne" | "sw" | "se";

const LOCAL_SELECTION_COLOR = "#3b82f6";
const REMOTE_SELECTION_FALLBACK_COLOR = "#3b82f6";

function CornerHandle({
  corner,
  x,
  y,
  onDragStart,
}: {
  corner: Corner;
  x: number;
  y: number;
  onDragStart: (e: React.PointerEvent, corner: Corner) => void;
}) {
  const size = 14;
  const style: React.CSSProperties = {
    position: "absolute",
    left: x - size / 2,
    top: y - size / 2,
    width: size,
    height: size,
    backgroundColor: "#ffffff",
    border: `2px solid ${LOCAL_SELECTION_COLOR}`,
    cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize",
  };

  return (
    <div
      style={style}
      onPointerDown={(e) => {
        e.stopPropagation();
        onDragStart(e, corner);
      }}
    />
  );
}

export function SelectionOverlay({
  nodes,
  selectedNodeId,
  remoteSelections,
  users,
  transform,
  onResize,
}: Props) {
  const dragRef = useRef<{
    active: boolean;
    corner: Corner;
    nodeId: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user] as const)),
    [users],
  );

  const selectedNode = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId)
    : null;

  const handleDragStart = useCallback(
    (e: React.PointerEvent, corner: Corner) => {
      if (!selectedNode) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        active: true,
        corner,
        nodeId: selectedNode.id,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: selectedNode.width,
        startHeight: selectedNode.height,
      };
    },
    [selectedNode],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag?.active) return;

      const node = nodes.find((n) => n.id === drag.nodeId);
      if (!node) return;

      const dx = (e.clientX - drag.startX) / transform.zoom;
      const dy = (e.clientY - drag.startY) / transform.zoom;

      let newWidth = drag.startWidth;
      let newHeight = drag.startHeight;

      switch (drag.corner) {
        case "se":
          newWidth = Math.max(100, drag.startWidth + dx);
          newHeight = Math.max(80, drag.startHeight + dy);
          break;
        case "sw":
          newWidth = Math.max(100, drag.startWidth - dx);
          newHeight = Math.max(80, drag.startHeight + dy);
          break;
        case "ne":
          newWidth = Math.max(100, drag.startWidth + dx);
          newHeight = Math.max(80, drag.startHeight - dy);
          break;
        case "nw":
          newWidth = Math.max(100, drag.startWidth - dx);
          newHeight = Math.max(80, drag.startHeight - dy);
          break;
      }

      // Loaded problem nodes use content-derived height from DOM measurement sync.
      if (node.type === "problem" && node.data.status === "loaded") {
        newHeight = node.height;
      }

      onResize(drag.nodeId, newWidth, newHeight);
    },
    [nodes, transform.zoom, onResize],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {Array.from(remoteSelections.entries()).map(([remoteUserId, nodeId]) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return null;

        const color =
          usersById.get(remoteUserId)?.color ?? REMOTE_SELECTION_FALLBACK_COLOR;
        const x = node.x * transform.zoom + transform.x;
        const y = node.y * transform.zoom + transform.y;
        const w = node.width * transform.zoom;
        const h = node.height * transform.zoom;

        return (
          <div
            key={remoteUserId}
            className="absolute"
            style={{
              left: x - 2,
              top: y - 2,
              width: w + 4,
              height: h + 4,
              border: `2px solid ${color}`,
              borderRadius: 2,
            }}
          />
        );
      })}

      {selectedNode && (
        <>
          <div
            className="absolute"
            style={{
              left: selectedNode.x * transform.zoom + transform.x,
              top: selectedNode.y * transform.zoom + transform.y,
              width: selectedNode.width * transform.zoom,
              height: selectedNode.height * transform.zoom,
              border: `2px solid ${LOCAL_SELECTION_COLOR}`,
            }}
          />

          <div className="pointer-events-auto">
            <CornerHandle
              corner="nw"
              x={selectedNode.x * transform.zoom + transform.x}
              y={selectedNode.y * transform.zoom + transform.y}
              onDragStart={handleDragStart}
            />
            <CornerHandle
              corner="ne"
              x={(selectedNode.x + selectedNode.width) * transform.zoom + transform.x}
              y={selectedNode.y * transform.zoom + transform.y}
              onDragStart={handleDragStart}
            />
            <CornerHandle
              corner="sw"
              x={selectedNode.x * transform.zoom + transform.x}
              y={(selectedNode.y + selectedNode.height) * transform.zoom + transform.y}
              onDragStart={handleDragStart}
            />
            <CornerHandle
              corner="se"
              x={(selectedNode.x + selectedNode.width) * transform.zoom + transform.x}
              y={(selectedNode.y + selectedNode.height) * transform.zoom + transform.y}
              onDragStart={handleDragStart}
            />
          </div>
        </>
      )}
    </div>
  );
}

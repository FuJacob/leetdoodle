import { useCallback, useRef } from "react";
import type { CanvasNode } from "../shared/nodes";
import type { Transform } from "./types";

interface Props {
  nodes: CanvasNode[];
  selectedNodeId: string | null;
  remoteSelections: Map<string, string>; // userId → nodeId
  transform: Transform;
  onResize: (nodeId: string, width: number, height: number) => void;
}

// Colors for remote user selections (cycle through these)
const SELECTION_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SELECTION_COLORS[Math.abs(hash) % SELECTION_COLORS.length];
}

// Corner cap component for local selection
function CornerCap({
  position,
  x,
  y,
  onDragStart,
}: {
  position: "nw" | "ne" | "sw" | "se";
  x: number;
  y: number;
  onDragStart: (e: React.PointerEvent, corner: "nw" | "ne" | "sw" | "se") => void;
}) {
  const size = 12;
  const thickness = 2;

  // Position offset based on corner
  const style: React.CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    cursor:
      position === "nw" || position === "se" ? "nwse-resize" : "nesw-resize",
  };

  // Calculate position
  switch (position) {
    case "nw":
      style.left = x - size / 2;
      style.top = y - size / 2;
      break;
    case "ne":
      style.left = x - size / 2;
      style.top = y - size / 2;
      break;
    case "sw":
      style.left = x - size / 2;
      style.top = y - size / 2;
      break;
    case "se":
      style.left = x - size / 2;
      style.top = y - size / 2;
      break;
  }

  // L-shape borders based on corner
  const borderStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    borderColor: "#3b82f6",
    borderStyle: "solid",
    borderWidth: 0,
  };

  switch (position) {
    case "nw":
      borderStyle.borderTopWidth = thickness;
      borderStyle.borderLeftWidth = thickness;
      break;
    case "ne":
      borderStyle.borderTopWidth = thickness;
      borderStyle.borderRightWidth = thickness;
      break;
    case "sw":
      borderStyle.borderBottomWidth = thickness;
      borderStyle.borderLeftWidth = thickness;
      break;
    case "se":
      borderStyle.borderBottomWidth = thickness;
      borderStyle.borderRightWidth = thickness;
      break;
  }

  return (
    <div
      style={style}
      onPointerDown={(e) => {
        e.stopPropagation();
        onDragStart(e, position);
      }}
    >
      <div style={borderStyle} />
    </div>
  );
}

export function SelectionOverlay({
  nodes,
  selectedNodeId,
  remoteSelections,
  transform,
  onResize,
}: Props) {
  const dragRef = useRef<{
    active: boolean;
    corner: "nw" | "ne" | "sw" | "se";
    nodeId: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startNodeX: number;
    startNodeY: number;
  } | null>(null);

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null;

  const handleDragStart = useCallback(
    (e: React.PointerEvent, corner: "nw" | "ne" | "sw" | "se") => {
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
        startNodeX: selectedNode.x,
        startNodeY: selectedNode.y,
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

      // Calculate new size based on which corner is being dragged
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
      {/* Remote selections — thin border */}
      {Array.from(remoteSelections.entries()).map(([remoteUserId, nodeId]) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return null;

        const color = getUserColor(remoteUserId);
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

      {/* Local selection — corner caps */}
      {selectedNode && (
        <>
          {/* Selection outline (subtle) */}
          <div
            className="absolute border border-blue-500/50"
            style={{
              left: selectedNode.x * transform.zoom + transform.x,
              top: selectedNode.y * transform.zoom + transform.y,
              width: selectedNode.width * transform.zoom,
              height: selectedNode.height * transform.zoom,
            }}
          />

          {/* Corner caps with pointer-events enabled */}
          <div className="pointer-events-auto">
            <CornerCap
              position="nw"
              x={selectedNode.x * transform.zoom + transform.x}
              y={selectedNode.y * transform.zoom + transform.y}
              onDragStart={handleDragStart}
            />
            <CornerCap
              position="ne"
              x={(selectedNode.x + selectedNode.width) * transform.zoom + transform.x}
              y={selectedNode.y * transform.zoom + transform.y}
              onDragStart={handleDragStart}
            />
            <CornerCap
              position="sw"
              x={selectedNode.x * transform.zoom + transform.x}
              y={(selectedNode.y + selectedNode.height) * transform.zoom + transform.y}
              onDragStart={handleDragStart}
            />
            <CornerCap
              position="se"
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

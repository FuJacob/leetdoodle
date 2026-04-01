import { useCallback, useEffect, useMemo, useRef } from "react";
import { IconCopy, IconTrash } from "@tabler/icons-react";
import type { CanvasNode } from "../shared/nodes";
import type { CollabUser } from "./hooks/useCanvasCollab";
import type { LocalCursorMode, Transform } from "./types";

interface Props {
  nodes: CanvasNode[];
  selectedNodeId: string | null;
  remoteSelections: Map<string, string>; // userId → nodeId
  users: CollabUser[];
  transform: Transform;
  onResize: (nodeId: string, width: number, height: number) => void;
  onClone: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onLocalCursorModeChange: (mode: LocalCursorMode) => void;
}

type Corner = "nw" | "ne" | "sw" | "se";

const LOCAL_SELECTION_COLOR = "var(--lc-selection-local)";
const REMOTE_SELECTION_FALLBACK_COLOR = "var(--lc-selection-remote-fallback)";
const TOOLBAR_HORIZONTAL_OFFSET = 10;
const TOOLBAR_VERTICAL_OFFSET = 18;

function getCursorModeForCorner(corner: Corner): LocalCursorMode {
  return corner === "nw" || corner === "se" ? "resize-nwse" : "resize-nesw";
}

function CornerHandle({
  corner,
  x,
  y,
  onDragStart,
  onCursorModeChange,
}: {
  corner: Corner;
  x: number;
  y: number;
  onDragStart: (e: React.PointerEvent, corner: Corner) => void;
  onCursorModeChange: (mode: LocalCursorMode) => void;
}) {
  const outerSize = 16;
  const innerSize = 8;
  const style: React.CSSProperties = {
    position: "absolute",
    left: x - outerSize / 2,
    top: y - outerSize / 2,
    width: outerSize,
    height: outerSize,
    backgroundColor: LOCAL_SELECTION_COLOR,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize",
  };

  return (
    <div
      style={style}
      onPointerDown={(e) => {
        e.stopPropagation();
        onCursorModeChange(getCursorModeForCorner(corner));
        onDragStart(e, corner);
      }}
      onPointerEnter={() => {
        onCursorModeChange(getCursorModeForCorner(corner));
      }}
      onPointerLeave={() => {
        onCursorModeChange("pointer");
      }}
    >
      <div
        style={{
          width: innerSize,
          height: innerSize,
          backgroundColor: "#ffffff",
        }}
      />
    </div>
  );
}

function ActionIconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className="flex h-8 w-8 items-center justify-center border border-(--lc-border-strong) bg-(--lc-surface-1) text-(--lc-text-secondary) shadow-sm transition hover:border-(--lc-border-focus) hover:text-(--lc-accent)"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export function SelectionOverlay({
  nodes,
  selectedNodeId,
  remoteSelections,
  users,
  transform,
  onResize,
  onClone,
  onDelete,
  onLocalCursorModeChange,
}: Props) {
  const localSelectionColor = "var(--lc-selection-local)";
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

  useEffect(() => {
    if (!selectedNode) {
      onLocalCursorModeChange("pointer");
    }
  }, [selectedNode, onLocalCursorModeChange]);

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
    onLocalCursorModeChange("pointer");
  }, [onLocalCursorModeChange]);

  const handleClone = useCallback(() => {
    if (!selectedNode) return;
    onClone(selectedNode.id);
  }, [selectedNode, onClone]);

  const handleDelete = useCallback(() => {
    if (!selectedNode) return;
    onDelete(selectedNode.id);
  }, [selectedNode, onDelete]);

  return (
    <div
      className="absolute inset-0 z-20 pointer-events-none"
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
              border: `2px solid ${localSelectionColor}`,
            }}
          />

          <div className="pointer-events-auto">
            <CornerHandle
              corner="nw"
              x={selectedNode.x * transform.zoom + transform.x}
              y={selectedNode.y * transform.zoom + transform.y}
              onDragStart={handleDragStart}
              onCursorModeChange={onLocalCursorModeChange}
            />
            <CornerHandle
              corner="ne"
              x={(selectedNode.x + selectedNode.width) * transform.zoom + transform.x}
              y={selectedNode.y * transform.zoom + transform.y}
              onDragStart={handleDragStart}
              onCursorModeChange={onLocalCursorModeChange}
            />
            <CornerHandle
              corner="sw"
              x={selectedNode.x * transform.zoom + transform.x}
              y={(selectedNode.y + selectedNode.height) * transform.zoom + transform.y}
              onDragStart={handleDragStart}
              onCursorModeChange={onLocalCursorModeChange}
            />
            <CornerHandle
              corner="se"
              x={(selectedNode.x + selectedNode.width) * transform.zoom + transform.x}
              y={(selectedNode.y + selectedNode.height) * transform.zoom + transform.y}
              onDragStart={handleDragStart}
              onCursorModeChange={onLocalCursorModeChange}
            />

            <div
              className="absolute flex flex-col gap-2"
              style={{
                left:
                  (selectedNode.x + selectedNode.width) * transform.zoom +
                  transform.x +
                  TOOLBAR_HORIZONTAL_OFFSET,
                top:
                  selectedNode.y * transform.zoom +
                  transform.y +
                  TOOLBAR_VERTICAL_OFFSET,
              }}
            >
              <ActionIconButton title="Clone node" onClick={handleClone}>
                <IconCopy size={16} stroke={2} />
              </ActionIconButton>
              <ActionIconButton title="Delete node" onClick={handleDelete}>
                <IconTrash size={16} stroke={2} />
              </ActionIconButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

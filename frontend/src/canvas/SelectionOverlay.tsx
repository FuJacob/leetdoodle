import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconCopy, IconPlus, IconTrash } from "@tabler/icons-react";
import type { CanvasNode, NodeType } from "../shared/nodes";
import type { CollabUser } from "./presence/types";
import type { LocalCursorMode, Transform } from "./types";
import {
  CONTROL_ICON_SIZE,
  CONTROL_ICON_STROKE,
  NODE_CONTROL_OPTIONS,
  OVERLAY_ACTION_ICON_SIZE,
} from "./ui/controlOptions";
import {
  ACTION_TRAY_CLASS,
  BUTTON_CLASS,
  INTERACTIVE_CONTROL_CLASS,
} from "../shared/ui/styles";

interface Props {
  nodes: CanvasNode[];
  selectedNodeIds: Set<string>;
  remoteSelections: Map<string, Set<string>>; // userId → nodeIds
  users: CollabUser[];
  transform: Transform;
  onResize: (nodeId: string, width: number, height: number) => void;
  onClone: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onSpawn: (type: NodeType, fromNodeId?: string) => void;
  onLocalCursorModeChange: (mode: LocalCursorMode) => void;
}

const LOCAL_SELECTION_COLOR = "var(--lc-selection-local)";
const REMOTE_SELECTION_FALLBACK_COLOR = "var(--lc-selection-remote-fallback)";
const RESIZE_HANDLE_COLOR = "var(--lc-text-inverse)";
const TOOLBAR_HORIZONTAL_OFFSET = 10;
const TOOLBAR_VERTICAL_OFFSET = 18;

function ResizeHandle({
  x,
  y,
  onResizeStart,
  onCursorModeChange,
}: {
  x: number;
  y: number;
  onResizeStart: (e: React.PointerEvent) => void;
  onCursorModeChange: (mode: LocalCursorMode) => void;
}) {
  const hitboxSize = 24;
  const capSize = 14;
  const capStroke = 4;
  const style: React.CSSProperties = {
    position: "absolute",
    left: x - hitboxSize / 2,
    top: y - hitboxSize / 2,
    width: hitboxSize,
    height: hitboxSize,
    cursor: "nwse-resize",
    zIndex: 1,
  };

  return (
    <div
      style={style}
      onPointerDown={(e) => {
        e.stopPropagation();
        onCursorModeChange("resize-nwse");
        onResizeStart(e);
      }}
      onPointerEnter={() => {
        onCursorModeChange("resize-nwse");
      }}
      onPointerLeave={() => {
        onCursorModeChange("pointer");
      }}
    >
      <div
        style={{
          position: "absolute",
          right: hitboxSize / 2 - 2,
          bottom: hitboxSize / 2 - 2,
          width: capSize,
          height: capSize,
          borderRight: `${capStroke}px solid ${RESIZE_HANDLE_COLOR}`,
          borderBottom: `${capStroke}px solid ${RESIZE_HANDLE_COLOR}`,
          borderBottomRightRadius: 8,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function ActionIconButton({
  title,
  active = false,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`flex h-11 w-11 items-center justify-center border bg-(--lc-surface-1) text-(--lc-text-secondary) shadow-sm transition hover:border-(--lc-border-focus) hover:text-(--lc-accent) ${
        INTERACTIVE_CONTROL_CLASS
      } ${
        active
          ? "border-(--lc-border-focus) bg-(--lc-surface-2) text-(--lc-accent)"
          : "border-(--lc-border-strong)"
      }`}
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
  selectedNodeIds,
  remoteSelections,
  users,
  transform,
  onResize,
  onClone,
  onDelete,
  onSpawn,
  onLocalCursorModeChange,
}: Props) {
  const [addNodePanelOwnerId, setAddNodePanelOwnerId] = useState<string | null>(
    null,
  );
  const dragRef = useRef<{
    active: boolean;
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

  const selectedNodes = useMemo(
    () => nodes.filter((n) => selectedNodeIds.has(n.id)),
    [nodes, selectedNodeIds],
  );

  // Single-select: show resize affordance + action toolbar
  const singleSelectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;

  useEffect(() => {
    if (selectedNodes.length === 0) {
      onLocalCursorModeChange("pointer");
    }
  }, [selectedNodes.length, onLocalCursorModeChange]);

  const showAddNodePanel =
    singleSelectedNode != null && addNodePanelOwnerId === singleSelectedNode.id;

  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (!singleSelectedNode) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        active: true,
        nodeId: singleSelectedNode.id,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: singleSelectedNode.width,
        startHeight: singleSelectedNode.height,
      };
    },
    [singleSelectedNode],
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
      newWidth = Math.max(100, drag.startWidth + dx);
      newHeight = Math.max(80, drag.startHeight + dy);

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
    if (!singleSelectedNode) return;
    onClone(singleSelectedNode.id);
  }, [singleSelectedNode, onClone]);

  const handleDelete = useCallback(() => {
    if (!singleSelectedNode) return;
    onDelete(singleSelectedNode.id);
  }, [singleSelectedNode, onDelete]);

  const handleAddNodeToggle = useCallback(() => {
    if (!singleSelectedNode) {
      setAddNodePanelOwnerId(null);
      return;
    }
    setAddNodePanelOwnerId((prev) =>
      prev === singleSelectedNode.id ? null : singleSelectedNode.id,
    );
  }, [singleSelectedNode]);

  const handleSpawnFromSelected = useCallback(
    (type: NodeType) => {
      if (!singleSelectedNode) return;
      onSpawn(type, singleSelectedNode.id);
      setAddNodePanelOwnerId(null);
    },
    [singleSelectedNode, onSpawn],
  );

  return (
    <div
      className="absolute inset-0 z-20 pointer-events-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Remote selections */}
      {Array.from(remoteSelections.entries()).flatMap(([remoteUserId, nodeIds]) => {
        const color =
          usersById.get(remoteUserId)?.color ?? REMOTE_SELECTION_FALLBACK_COLOR;
        return Array.from(nodeIds).map((nodeId) => {
          const node = nodes.find((n) => n.id === nodeId);
          if (!node) return null;

          const x = node.x * transform.zoom + transform.x;
          const y = node.y * transform.zoom + transform.y;
          const w = node.width * transform.zoom;
          const h = node.height * transform.zoom;

          return (
            <div
              key={`${remoteUserId}-${nodeId}`}
              className="absolute"
              style={{
                left: x - 2,
                top: y - 2,
                width: w + 4,
                height: h + 4,
                border: `2px solid ${color}`,
                borderRadius: 6,
              }}
            />
          );
        });
      })}

      {/* Local selection borders for all selected nodes */}
      {selectedNodes.map((node) => (
        <div
          key={node.id}
          className="absolute"
          style={{
            left: node.x * transform.zoom + transform.x,
            top: node.y * transform.zoom + transform.y,
            width: node.width * transform.zoom,
            height: node.height * transform.zoom,
            border: `2px solid ${LOCAL_SELECTION_COLOR}`,
            borderRadius: 6,
          }}
        />
      ))}

      {/* Single-select: resize handle + action toolbar */}
      {singleSelectedNode && (
        <div className="pointer-events-auto">
          <ResizeHandle
            x={(singleSelectedNode.x + singleSelectedNode.width) * transform.zoom + transform.x}
            y={(singleSelectedNode.y + singleSelectedNode.height) * transform.zoom + transform.y}
            onResizeStart={handleDragStart}
            onCursorModeChange={onLocalCursorModeChange}
          />

          <div
            className="absolute flex flex-col gap-2"
            style={{
              left:
                (singleSelectedNode.x + singleSelectedNode.width) * transform.zoom +
                transform.x +
                TOOLBAR_HORIZONTAL_OFFSET,
              top:
                singleSelectedNode.y * transform.zoom +
                transform.y +
                TOOLBAR_VERTICAL_OFFSET,
            }}
          >
            <ActionIconButton
              title="Add linked node"
              active={showAddNodePanel}
              onClick={handleAddNodeToggle}
            >
              <IconPlus size={OVERLAY_ACTION_ICON_SIZE} stroke={2} />
            </ActionIconButton>
            <ActionIconButton title="Clone node" onClick={handleClone}>
              <IconCopy size={OVERLAY_ACTION_ICON_SIZE} stroke={2} />
            </ActionIconButton>
            <ActionIconButton title="Delete node" onClick={handleDelete}>
              <IconTrash size={OVERLAY_ACTION_ICON_SIZE} stroke={2} />
            </ActionIconButton>

            {showAddNodePanel && (
              <div
                className={`absolute right-full top-0 mr-2 flex gap-2 ${ACTION_TRAY_CLASS}`}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {NODE_CONTROL_OPTIONS.map(({ type, label, Icon }) => (
                  <button
                    key={type}
                    type="button"
                    className={`${BUTTON_CLASS} gap-2 bg-(--lc-surface-1) px-2 py-1 text-xs`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpawnFromSelected(type);
                    }}
                  >
                    <Icon size={CONTROL_ICON_SIZE} stroke={CONTROL_ICON_STROKE} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

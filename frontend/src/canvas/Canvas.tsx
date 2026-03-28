import { useCallback, useEffect, useRef, useState } from 'react';
import { type CanvasNode, type Edge, type NodeType, createNoteNode, createProblemNode, createCodeNode } from '../shared/nodes';
import type { CanvasOutboundEvent } from '../shared/events';
import { useCanvasCrdt } from '../shared/crdt/useCanvasCrdt';
import { useCanvasTransform } from './hooks/useCanvasTransform';
import { useNodeDrag } from './hooks/useNodeDrag';
import { useCanvasCollab } from './hooks/useCanvasCollab';
import { screenToWorld } from './utils/coordinates';
import { NodeRenderer } from './NodeRenderer';
import { CursorOverlay } from './CursorOverlay';
import { EdgesOverlay } from './EdgesOverlay';
import { SelectionOverlay } from './SelectionOverlay';
import { SpawnPanel } from './SpawnPanel';

interface CanvasProps {
  canvasId: string;
  userId: string;
}

function spawnNode(type: NodeType, x: number, y: number): CanvasNode {
  switch (type) {
    case 'note':    return createNoteNode(x, y);
    case 'problem': return createProblemNode(x, y);
    case 'code':    return createCodeNode(x, y);
  }
}

export function Canvas({ canvasId, userId }: CanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [remoteSelections, setRemoteSelections] = useState<Map<string, string>>(new Map());
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

  // Collab hook with event handlers for remote updates
  const { cursors, send, onPointerMove: collabPointerMove } = useCanvasCollab(
    canvasId,
    userId,
    viewportRef,
    transformRef,
    {
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
          prev.map((n) => (n.id === nodeId ? { ...n, ...patch } as CanvasNode : n)),
        );
      },
      onNodeDelete: (nodeId) => {
        setNodes((prev) => prev.filter((n) => n.id !== nodeId));
        setEdges((prev) => prev.filter((e) => e.fromNodeId !== nodeId && e.toNodeId !== nodeId));
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
    },
  );

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Update node locally + broadcast to others
  const updateNode = useCallback(
    (id: string, patch: Partial<CanvasNode>) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...patch } as CanvasNode : n)),
      );
      send({ type: 'node_update', nodeId: id, patch });
    },
    [send],
  );

  // Move node locally + broadcast — called by drag hook
  const moveNode = useCallback(
    (id: string, x: number, y: number) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, x, y } : n)),
      );
      send({ type: 'node_move', nodeId: id, x, y });
    },
    [send],
  );

  // Resize node locally + broadcast — called by selection overlay
  const resizeNode = useCallback(
    (id: string, width: number, height: number) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, width, height } : n)),
      );
      send({ type: 'node_update', nodeId: id, patch: { width, height } });
    },
    [send],
  );

  // Select node locally + broadcast
  const selectNode = useCallback(
    (nodeId: string | null) => {
      setSelectedNodeId(nodeId);
      send({ type: 'node_select', userId, nodeId });
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
      dragPointerUp(e);
    },
    [panPointerUp, dragPointerUp],
  );

  const handleSpawn = useCallback(
    (type: NodeType, fromNodeId?: string) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const world = screenToWorld(rect.width / 2, rect.height / 2, transformRef.current);
      const node = spawnNode(type, world.x, world.y);
      node.x = world.x - node.width / 2;
      node.y = world.y - node.height / 2;

      // Optimistic: apply locally first
      setNodes((prev) => [...prev, node]);
      send({ type: 'node_create', node });

      // Select the newly created node
      selectNode(node.id);

      if (fromNodeId) {
        const edge: Edge = { id: crypto.randomUUID(), fromNodeId, toNodeId: node.id };
        setEdges((prev) => [...prev, edge]);
        send({ type: 'edge_create', edge });
      }
    },
    [transformRef, send, selectNode],
  );

  return (
    <div
      ref={viewportRef}
      className="fixed inset-0 overflow-hidden bg-zinc-950 bg-[radial-gradient(circle,var(--color-zinc-700)_1px,transparent_1px)] bg-size-[32px_32px]"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <SpawnPanel onSpawn={handleSpawn} />
      <CursorOverlay cursors={cursors} transform={transform} />
      <EdgesOverlay nodes={nodes} edges={edges} transform={transform} />
      <SelectionOverlay
        nodes={nodes}
        selectedNodeId={selectedNodeId}
        remoteSelections={remoteSelections}
        transform={transform}
        onResize={resizeNode}
      />

      <div
        className="absolute left-0 top-0"
        style={{
          transformOrigin: '0 0',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
          width: 0,
          height: 0,
        }}
      >
        {nodes.map((node) => (
          <NodeRenderer
            key={node.id}
            node={node}
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

import { useCallback, useRef, useState } from 'react';
import { type CanvasNode, type Edge, type NodeType, createNoteNode, createProblemNode, createCodeNode } from '../shared/nodes';
import { useCanvasTransform } from './hooks/useCanvasTransform';
import { useNodeDrag } from './hooks/useNodeDrag';
import { useCanvasCollab } from './hooks/useCanvasCollab';
import { screenToWorld } from './utils/coordinates';
import { NodeRenderer } from './NodeRenderer';
import { CursorOverlay } from './CursorOverlay';
import { EdgesOverlay } from './EdgesOverlay';
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

  const {
    transform,
    transformRef,
    onPointerDown: panPointerDown,
    onPointerMove: panPointerMove,
    onPointerUp: panPointerUp,
  } = useCanvasTransform(viewportRef);

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
      },
      onEdgeCreate: (edge) => {
        setEdges((prev) => [...prev, edge]);
      },
      onEdgeDelete: (edgeId) => {
        setEdges((prev) => prev.filter((e) => e.id !== edgeId));
      },
    },
  );

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

  const {
    onNodePointerDown,
    onPointerMove: dragPointerMove,
    onPointerUp: dragPointerUp,
  } = useNodeDrag(transformRef, moveNode);

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

      if (fromNodeId) {
        const edge: Edge = { id: crypto.randomUUID(), fromNodeId, toNodeId: node.id };
        setEdges((prev) => [...prev, edge]);
        send({ type: 'edge_create', edge });
      }
    },
    [transformRef, send],
  );

  return (
    <div
      ref={viewportRef}
      className="fixed inset-0 overflow-hidden bg-zinc-950 bg-[radial-gradient(circle,var(--color-zinc-700)_1px,transparent_1px)] bg-size-[32px_32px]"
      onPointerDown={panPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <SpawnPanel onSpawn={handleSpawn} />
      <CursorOverlay cursors={cursors} transform={transform} />
      <EdgesOverlay nodes={nodes} edges={edges} transform={transform} />

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
          />
        ))}
      </div>
    </div>
  );
}

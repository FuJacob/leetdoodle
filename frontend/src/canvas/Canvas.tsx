import { useCallback, useRef, useState } from 'react';
import { type CanvasNode, type NodeType, createNoteNode, createProblemNode } from '../shared/nodes';
import { useCanvasTransform } from './hooks/useCanvasTransform';
import { useNodeDrag } from './hooks/useNodeDrag';
import { useCollabCursors } from './hooks/useCollabCursors';
import { screenToWorld } from './utils/coordinates';
import { NodeRenderer } from './NodeRenderer';
import { CursorOverlay } from './CursorOverlay';
import { SpawnPanel } from './SpawnPanel';

interface CanvasProps {
  canvasId: string;
  userId: string;
}

function spawnNode(type: NodeType, x: number, y: number): CanvasNode {
  switch (type) {
    case 'note':    return createNoteNode(x, y);
    case 'problem': return createProblemNode(x, y);
  }
}

export function Canvas({ canvasId, userId }: CanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);

  const {
    transform,
    transformRef,
    onPointerDown: panPointerDown,
    onPointerMove: panPointerMove,
    onPointerUp: panPointerUp,
  } = useCanvasTransform(viewportRef);

  const updateNode = useCallback((id: string, patch: Partial<CanvasNode>) => {
    setNodes(prev =>
      prev.map(n => (n.id === id ? { ...n, ...patch } as CanvasNode : n)),
    );
  }, []);

  const {
    onNodePointerDown,
    onPointerMove: dragPointerMove,
    onPointerUp: dragPointerUp,
  } = useNodeDrag(transformRef, updateNode);

  const { cursors, onPointerMove: collabPointerMove } = useCollabCursors(
    canvasId, userId, viewportRef, transformRef,
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
    (type: NodeType) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const world = screenToWorld(rect.width / 2, rect.height / 2, transformRef.current);
      const node = spawnNode(type, world.x, world.y);
      node.x = world.x - node.width / 2;
      node.y = world.y - node.height / 2;
      setNodes(prev => [...prev, node]);
    },
    [transformRef],
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

      <div
        className="absolute left-0 top-0"
        style={{
          transformOrigin: '0 0',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
          width: 0,
          height: 0,
        }}
      >
        {nodes.map(node => (
          <NodeRenderer
            key={node.id}
            node={node}
            onPointerDown={onNodePointerDown}
            onUpdate={updateNode}
          />
        ))}
      </div>
    </div>
  );
}

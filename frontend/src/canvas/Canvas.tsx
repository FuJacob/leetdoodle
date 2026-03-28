import { useCallback, useRef, useState } from 'react';
import { CanvasNode, NoteNode, ProblemNode, type NodeType } from './nodes';
import { useCanvasTransform } from './hooks/useCanvasTransform';
import { useNodeDrag } from './hooks/useNodeDrag';
import { screenToWorld } from './utils/coordinates';
import { NodeRenderer } from '../nodes/NodeRenderer';
import { SpawnPanel } from './SpawnPanel';

function spawnNode(type: NodeType, x: number, y: number): CanvasNode {
  switch (type) {
    case 'note':    return NoteNode.create(x, y);
    case 'problem': return ProblemNode.create(x, y);
  }
}

export function Canvas() {
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
    setNodes(prev => prev.map(n => (n.id === id ? Object.assign(Object.create(Object.getPrototypeOf(n)), n, patch) : n)));
  }, []);

  const {
    onNodePointerDown,
    onPointerMove: dragPointerMove,
    onPointerUp: dragPointerUp,
  } = useNodeDrag(transformRef, updateNode);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      panPointerMove(e);
      dragPointerMove(e);
    },
    [panPointerMove, dragPointerMove],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      panPointerUp(e);
      dragPointerUp(e);
    },
    [panPointerUp, dragPointerUp],
  );

  // Spawn a node at the center of the visible viewport, converted to world space.
  const handleSpawn = useCallback(
    (type: NodeType) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const world = screenToWorld(rect.width / 2, rect.height / 2, transformRef.current);
      const node = spawnNode(type, world.x, world.y);
      // Center the node on the spawn point
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
          />
        ))}
      </div>
    </div>
  );
}

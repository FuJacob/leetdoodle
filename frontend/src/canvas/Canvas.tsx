import { useCallback, useRef, useState } from 'react';
import type { CanvasNode } from './types';
import { useCanvasTransform } from './hooks/useCanvasTransform';
import { useNodeDrag } from './hooks/useNodeDrag';
import { screenToWorld } from './utils/coordinates';
import { NodeRenderer } from '../nodes/NodeRenderer';

let nextId = 1;

function makeNode(x: number, y: number): CanvasNode {
  return {
    id: String(nextId++),
    type: 'note',
    x,
    y,
    width: 200,
    height: 80,
    data: { content: 'New note' },
  };
}

export function Canvas() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);

  // useCanvasTransform attaches the wheel listener internally via useEffect.
  // No onWheel prop needed on the viewport div.
  const {
    transform,
    transformRef,
    onPointerDown: panPointerDown,
    onPointerMove: panPointerMove,
    onPointerUp: panPointerUp,
  } = useCanvasTransform(viewportRef);

  const updateNode = useCallback((id: string, patch: Partial<CanvasNode>) => {
    setNodes(prev => prev.map(n => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const {
    onNodePointerDown,
    onPointerMove: dragPointerMove,
    onPointerUp: dragPointerUp,
  } = useNodeDrag(transformRef, updateNode);

  // Combine pan + drag at the viewport level.
  // Both handlers are no-ops when their respective interaction isn't active.
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

  // Place a node at world-space coordinates on double-click.
  // Uses transformRef.current (not state) for accurate positioning during fast interactions.
  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const world = screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top,
        transformRef.current,
      );
      setNodes(prev => [...prev, makeNode(world.x, world.y)]);
    },
    [transformRef],
  );

  return (
    <div
      ref={viewportRef}
      className="fixed inset-0 overflow-hidden bg-zinc-950 [background-image:radial-gradient(circle,theme(colors.zinc.700)_1px,transparent_1px)] [background-size:32px_32px]"
      onPointerDown={panPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
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

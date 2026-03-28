import type { CanvasNode, NodeType } from '../shared/nodes';
import { NoteNodeRenderer } from '../features/note/NoteNodeRenderer';
import { ProblemNodeRenderer } from '../features/problem/ProblemNodeRenderer';
import { CodeNodeRenderer } from '../features/code/CodeNodeRenderer';

interface Props {
  node: CanvasNode;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => void;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
  onSpawn: (type: NodeType, fromNodeId?: string) => void;
}

export function NodeRenderer({ node, onPointerDown, onUpdate, onSpawn }: Props) {
  switch (node.type) {
    case 'note':
      return <NoteNodeRenderer node={node} onPointerDown={onPointerDown} />;
    case 'problem':
      return <ProblemNodeRenderer node={node} onPointerDown={onPointerDown} onUpdate={onUpdate} onSpawn={onSpawn} />;
    case 'code':
      return <CodeNodeRenderer node={node} onPointerDown={onPointerDown} onUpdate={onUpdate} />;
  }
}

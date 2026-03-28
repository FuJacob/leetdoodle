import type { CanvasNode } from '../shared/nodes';
import { NoteNodeRenderer } from '../features/note/NoteNodeRenderer';
import { ProblemNodeRenderer } from '../features/problem/ProblemNodeRenderer';

interface Props {
  node: CanvasNode;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => void;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
}

export function NodeRenderer({ node, onPointerDown, onUpdate }: Props) {
  switch (node.type) {
    case 'note':
      return <NoteNodeRenderer node={node} onPointerDown={onPointerDown} />;
    case 'problem':
      return <ProblemNodeRenderer node={node} onPointerDown={onPointerDown} onUpdate={onUpdate} />;
  }
}

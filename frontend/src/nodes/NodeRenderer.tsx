import type { CanvasNode } from '../canvas/nodes';
import { NoteNodeRenderer } from './NoteNodeRenderer';
import { ProblemNodeRenderer } from './ProblemNodeRenderer';

interface Props {
  node: CanvasNode;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => void;
}

export function NodeRenderer({ node, onPointerDown }: Props) {
  switch (node.type) {
    case 'note':
      return <NoteNodeRenderer node={node} onPointerDown={onPointerDown} />;
    case 'problem':
      return <ProblemNodeRenderer node={node} onPointerDown={onPointerDown} />;
  }
}

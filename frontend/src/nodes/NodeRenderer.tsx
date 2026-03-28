import type { CanvasNode, NoteNode, ProblemNode } from '../canvas/nodes';
import { NoteNodeRenderer } from './NoteNodeRenderer';
import { ProblemNodeRenderer } from './ProblemNodeRenderer';

interface Props {
  node: CanvasNode;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => void;
}

export function NodeRenderer({ node, onPointerDown }: Props) {
  switch (node.type) {
    case 'note':
      return <NoteNodeRenderer node={node as unknown as NoteNode} onPointerDown={onPointerDown} />;
    case 'problem':
      return <ProblemNodeRenderer node={node as unknown as ProblemNode} onPointerDown={onPointerDown} />;
  }
}

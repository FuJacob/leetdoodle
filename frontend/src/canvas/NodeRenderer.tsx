import type { TextEdit } from "../shared/crdt";
import type { CanvasNode, Edge, NodeType } from "../shared/nodes";
import { NoteNodeRenderer } from "../features/note/NoteNodeRenderer";
import { ProblemNodeRenderer } from "../features/problem/ProblemNodeRenderer";
import { CodeNodeRenderer } from "../features/code/CodeNodeRenderer";
import { TestResultsNodeRenderer } from "../features/test-results/TestResultsNodeRenderer";
import { DrawNodeRenderer } from "../features/draw/DrawNodeRenderer";

interface Props {
  node: CanvasNode;
  nodes: CanvasNode[];
  edges: Edge[];
  onPointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    node: CanvasNode,
  ) => void;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
  onSpawn: (type: NodeType, fromNodeId?: string) => string | undefined;
  onTextEdits: (nodeId: string, edits: TextEdit[]) => void;
}

export function NodeRenderer({
  node,
  nodes,
  edges,
  onPointerDown,
  onUpdate,
  onSpawn,
  onTextEdits,
}: Props) {
  switch (node.type) {
    case "note":
      return (
        <NoteNodeRenderer
          node={node}
          onPointerDown={onPointerDown}
          onTextEdits={onTextEdits}
        />
      );
    case "problem":
      return (
        <ProblemNodeRenderer
          node={node}
          onPointerDown={onPointerDown}
          onUpdate={onUpdate}
          onSpawn={onSpawn}
        />
      );
    case "code":
      return (
        <CodeNodeRenderer
          node={node}
          nodes={nodes}
          edges={edges}
          onPointerDown={onPointerDown}
          onUpdate={onUpdate}
          onSpawn={onSpawn}
          onTextEdits={onTextEdits}
        />
      );
    case "test-results":
      return (
        <TestResultsNodeRenderer
          node={node}
          onPointerDown={onPointerDown}
          onUpdate={onUpdate}
        />
      );
    case "draw":
      return (
        <DrawNodeRenderer
          node={node}
          onPointerDown={onPointerDown}
          onUpdate={onUpdate}
        />
      );
  }
}

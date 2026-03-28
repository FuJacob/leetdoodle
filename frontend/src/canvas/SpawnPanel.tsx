import type { NodeType } from '../shared/nodes';

interface SpawnPanelProps {
  onSpawn: (type: NodeType) => void;
}

const NODE_OPTIONS: { type: NodeType; label: string }[] = [
  { type: 'note',    label: 'Note' },
  { type: 'problem', label: 'Problem' },
];

export function SpawnPanel({ onSpawn }: SpawnPanelProps) {
  return (
    <div className="absolute right-4 top-4 z-10 flex flex-col gap-2 border border-zinc-700 bg-zinc-900 p-3">
      <div className="text-xs font-semibold text-zinc-400">Add node</div>
      {NODE_OPTIONS.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => onSpawn(type)}
          className="border border-zinc-700 px-3 py-2 text-left text-sm text-zinc-200"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

import type { NodeType } from './nodes';

interface SpawnPanelProps {
  onSpawn: (type: NodeType) => void;
}

const NODE_OPTIONS: { type: NodeType; label: string; description: string; accent: string }[] = [
  {
    type: 'note',
    label: 'Note',
    description: 'Free-form text',
    accent: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10',
  },
  {
    type: 'problem',
    label: 'Problem',
    description: 'Title + description',
    accent: 'text-blue-400 border-blue-400/30 bg-blue-400/5 hover:bg-blue-400/10',
  },
];

export function SpawnPanel({ onSpawn }: SpawnPanelProps) {
  return (
    <div className="absolute right-4 top-4 z-10 flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/90 p-3 shadow-2xl backdrop-blur-sm">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Add node
      </div>
      {NODE_OPTIONS.map(({ type, label, description, accent }) => (
        <button
          key={type}
          onClick={() => onSpawn(type)}
          className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${accent}`}
        >
          <div>
            <div className="text-xs font-semibold">{label}</div>
            <div className="text-[10px] text-zinc-500">{description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

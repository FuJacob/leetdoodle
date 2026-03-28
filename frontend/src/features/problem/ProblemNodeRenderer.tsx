import { useState } from 'react';
import type { CanvasNode, ProblemData, ProblemNode } from '../../shared/nodes';
import { extractSlug, parseStats, difficultyClass } from './utils';

const LEETCODE_SERVICE = 'http://localhost:8081';

interface Props {
  node: ProblemNode;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => void;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
}

export function ProblemNodeRenderer({ node, onPointerDown, onUpdate }: Props) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const slug = extractSlug(url.trim());
    if (!slug) {
      onUpdate(node.id, { data: { status: 'error', message: 'Not a valid LeetCode problem URL.' } });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${LEETCODE_SERVICE}/api/problems/slug/${slug}`);
      if (!res.ok) {
        onUpdate(node.id, { data: { status: 'error', message: 'Problem not found.' } });
        return;
      }
      const p = await res.json();
      const data: ProblemData = {
        status:     'loaded',
        slug:       p.slug,
        title:      p.title,
        difficulty: p.difficulty,
        content:    p.content ?? '',
        tags:       p.tags ?? [],
        likes:      p.likes,
        dislikes:   p.dislikes,
        stats:      p.stats ?? null,
      };
      onUpdate(node.id, { data });
    } catch {
      onUpdate(node.id, { data: { status: 'error', message: 'Could not reach the LeetCode service.' } });
    } finally {
      setLoading(false);
    }
  }

  const base = 'absolute select-none border border-zinc-700 bg-zinc-900 p-3';

  // ── empty / error: URL input ─────────────────────────────────────────────

  if (node.data.status === 'empty' || node.data.status === 'error') {
    const error = node.data.status === 'error' ? node.data.message : null;
    return (
      <div
        className={`${base} cursor-grab active:cursor-grabbing`}
        style={{ left: node.x, top: node.y, width: node.width }}
        onPointerDown={e => onPointerDown(e, node)}
      >
        <div className="mb-2 text-xs font-semibold text-zinc-400">Problem</div>
        {/* Stop pointer-down so typing in the input doesn't start a drag */}
        <div onPointerDown={e => e.stopPropagation()}>
          <input
            type="text"
            className="w-full bg-zinc-800 border border-zinc-600 text-xs text-zinc-100 px-2 py-1 outline-none placeholder:text-zinc-500"
            placeholder="https://leetcode.com/problems/two-sum/"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button
            className="mt-2 w-full bg-zinc-700 text-xs text-zinc-100 py-1 disabled:opacity-40"
            onClick={handleCreate}
            disabled={loading || url.trim() === ''}
          >
            {loading ? 'Loading…' : 'Create'}
          </button>
          {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
        </div>
      </div>
    );
  }

  // ── loaded: problem details ───────────────────────────────────────────────

  const { title, difficulty, content, tags, likes, dislikes, stats } = node.data;
  const parsedStats = parseStats(stats);
  const description = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const preview = description.length > 200 ? description.slice(0, 200) + '…' : description;

  return (
    <div
      className={`${base} cursor-grab active:cursor-grabbing`}
      style={{ left: node.x, top: node.y, width: node.width }}
      onPointerDown={e => onPointerDown(e, node)}
    >
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-sm font-medium text-zinc-100">{title}</div>
        <div className={`text-xs ml-2 shrink-0 ${difficultyClass(difficulty)}`}>{difficulty}</div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map(t => (
            <span key={t.id} className="text-[10px] text-zinc-400 border border-zinc-700 px-1">
              {t.name}
            </span>
          ))}
        </div>
      )}

      <div className="text-xs text-zinc-400 mb-2 leading-relaxed">{preview}</div>

      <div className="flex gap-3 text-[10px] text-zinc-500">
        <span>▲ {likes}</span>
        <span>▼ {dislikes}</span>
        {parsedStats && <span>✓ {parsedStats.acRate}</span>}
      </div>
    </div>
  );
}

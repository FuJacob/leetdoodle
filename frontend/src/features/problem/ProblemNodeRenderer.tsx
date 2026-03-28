import { useState } from "react";
import type {
  CanvasNode,
  NodeType,
  ProblemData,
  ProblemNode,
} from "../../shared/nodes";
import { extractSlug, parseStats, difficultyClass } from "./utils";

const NODE_OPTIONS: { type: NodeType; label: string }[] = [
  { type: "note", label: "Note" },
  { type: "problem", label: "Problem" },
  { type: "code", label: "Code" },
];

const LEETCODE_SERVICE = "http://localhost:8081";

interface Props {
  node: ProblemNode;
  onPointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    node: CanvasNode,
  ) => void;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
  onSpawn: (type: NodeType, fromNodeId?: string) => void;
}

export function ProblemNodeRenderer({
  node,
  onPointerDown,
  onUpdate,
  onSpawn,
}: Props) {
  const [url, setUrl] = useState("https://leetcode.com/problems/two-sum/");
  const [loading, setLoading] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [showAddNodePanel, setShowAddNodePanel] = useState(false);

  async function handleCreate() {
    const slug = extractSlug(url.trim());
    if (!slug) {
      onUpdate(node.id, {
        data: { status: "error", message: "Not a valid LeetCode problem URL." },
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${LEETCODE_SERVICE}/api/problems/slug/${slug}`);
      if (!res.ok) {
        onUpdate(node.id, {
          data: { status: "error", message: "Problem not found." },
        });
        return;
      }
      const p = await res.json();
      const data: ProblemData = {
        status: "loaded",
        slug: p.slug,
        title: p.title,
        difficulty: p.difficulty,
        content: p.content ?? "",
        tags: p.tags ?? [],
        likes: p.likes,
        dislikes: p.dislikes,
        stats: p.stats ?? null,
      };
      onUpdate(node.id, { data });
    } catch {
      onUpdate(node.id, {
        data: {
          status: "error",
          message: "Could not reach the LeetCode service.",
        },
      });
    } finally {
      setLoading(false);
    }
  }

  const base = "absolute select-none border border-zinc-700 bg-zinc-900 p-3";

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);
  const handleAddNode = () => setShowAddNodePanel(true);
  const handleCloseAddNodePanel = () => setShowAddNodePanel(false);
  // ── empty / error: URL input ─────────────────────────────────────────────

  if (node.data.status === "empty" || node.data.status === "error") {
    const error = node.data.status === "error" ? node.data.message : null;
    return (
      <div
        className={`${base} cursor-grab active:cursor-grabbing`}
        style={{ left: node.x, top: node.y, width: node.width }}
        onPointerDown={(e) => onPointerDown(e, node)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="mb-2 text-xs font-semibold text-zinc-400">Problem</div>
        {/* Stop pointer-down so typing in the input doesn't start a drag */}
        <div onPointerDown={(e) => e.stopPropagation()}>
          <input
            type="text"
            className="w-full bg-zinc-800 border border-zinc-600 text-xs text-zinc-100 px-2 py-1 outline-none placeholder:text-zinc-500"
            placeholder="https://leetcode.com/problems/two-sum/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            className="mt-2 w-full bg-zinc-700 text-xs text-zinc-100 py-1 disabled:opacity-40"
            onClick={handleCreate}
            disabled={loading || url.trim() === ""}
          >
            {loading ? "Loading…" : "Create"}
          </button>
          {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
        </div>
      </div>
    );
  }

  // ── loaded: problem details ───────────────────────────────────────────────

  const { title, difficulty, content, tags, likes, dislikes, stats } =
    node.data;
  const parsedStats = parseStats(stats);
  const description = content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const preview =
    description.length > 200 ? description.slice(0, 200) + "…" : description;

  return (
    <div
      className={`${base} cursor-grab active:cursor-grabbing`}
      style={{ left: node.x, top: node.y, width: node.width }}
      onPointerDown={(e) => onPointerDown(e, node)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-sm font-medium text-zinc-100">{title}</div>
        <div className={`text-xs ml-2 shrink-0 ${difficultyClass(difficulty)}`}>
          {difficulty}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map((t) => (
            <span
              key={t.id}
              className="text-[10px] text-zinc-400 border border-zinc-700 px-1"
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      <div className="text-xs text-zinc-400 mb-2 leading-relaxed">
        {preview}
      </div>

      <div className="flex gap-3 text-[10px] text-zinc-500">
        <span>▲ {likes}</span>
        <span>▼ {dislikes}</span>
        {parsedStats && <span>✓ {parsedStats.acRate}</span>}
      </div>

      {/* Extends hover area below the node so the button doesn't flicker */}
      <div
        className="absolute bottom-2 left-0 right-0 translate-y-full"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Transparent bridge so mouse doesn't leave the hover zone */}
        <div className="h-1" />
        {isHovering && !showAddNodePanel && (
          <div className="flex justify-center">
            <button
              className="border border-zinc-700 bg-zinc-900 px-3 py-1 text-[10px] text-zinc-400"
              onClick={handleAddNode}
            >
              + add node
            </button>
          </div>
        )}

        {showAddNodePanel && (
          <div
            className="relative mt-2 p-2 bg-zinc-800 border border-zinc-600 text-xs"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseAddNodePanel}
              className="absolute top-1 right-1 text-zinc-500 hover:text-zinc-300 text-[10px]"
            >
              ✕
            </button>
            <div className="flex gap-2 pr-4">
              {NODE_OPTIONS.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => {
                    onSpawn(type, node.id);
                    handleCloseAddNodePanel();
                  }}
                  className="border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 hover:bg-zinc-700"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

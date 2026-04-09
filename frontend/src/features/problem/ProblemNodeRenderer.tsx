import { useCallback, useRef, useState } from "react";
import { IconPuzzle } from "@tabler/icons-react";
import type { CanvasNode, ProblemData, ProblemNode } from "../../shared/nodes";
import { extractSlug, parseStats, difficultyClass } from "./utils";
import { useNodeContentSizeSync } from "../../canvas/hooks/useNodeContentSizeSync";
import { LEETCODE_SERVICE_URL } from "../../shared/config/env";
import { NodeHeader } from "../shared/NodeHeader";

const MIN_NODE_WIDTH = 100;
const MIN_NODE_HEIGHT = 80;

interface Props {
  node: ProblemNode;
  onPointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    node: CanvasNode,
  ) => void;
  onUpdate: (id: string, patch: Partial<CanvasNode>) => void;
  dragStyle: React.CSSProperties;
}

export function ProblemNodeRenderer({
  node,
  onPointerDown,
  onUpdate,
  dragStyle,
}: Props) {
  const [url, setUrl] = useState("https://leetcode.com/problems/two-sum/");
  const [loading, setLoading] = useState(false);
  const loadedRootRef = useRef<HTMLDivElement | null>(null);
  const handleSizeSync = useCallback(
    (nodeId: string, width: number, height: number) => {
      onUpdate(nodeId, { width, height });
    },
    [onUpdate],
  );

  useNodeContentSizeSync({
    enabled: node.data.status === "loaded",
    nodeId: node.id,
    ref: loadedRootRef,
    currentWidth: node.width,
    currentHeight: node.height,
    minWidth: MIN_NODE_WIDTH,
    minHeight: MIN_NODE_HEIGHT,
    onSizeChange: handleSizeSync,
  });

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
      const res = await fetch(
        `${LEETCODE_SERVICE_URL}/api/problems/slug/${slug}`,
      );
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
        questionId: p.questionId,
        title: p.title,
        difficulty: p.difficulty,
        content: p.content ?? "",
        tags: p.tags ?? [],
        likes: p.likes,
        dislikes: p.dislikes,
        stats: p.stats ?? null,
        starterCode: p.starterCode ?? null,
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

  const base =
    "absolute border border-(--lc-border-default) bg-(--lc-surface-1) overflow-hidden";
  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerDown(e, node);
  };

  // ── empty / error: URL input ─────────────────────────────────────────────

  if (node.data.status === "empty" || node.data.status === "error") {
    const error = node.data.status === "error" ? node.data.message : null;
    return (
      <div
        className={`${base} flex flex-col`}
        style={{
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
          ...dragStyle,
        }}
      >
        <NodeHeader
          title="Problem"
          Icon={IconPuzzle}
          onPointerDown={handleHeaderPointerDown}
        />
        {/* Stop pointer-down so typing in the input doesn't start a drag */}
        <div
          className="flex-1 min-h-0 p-3"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            className="w-full border border-(--lc-border-strong) bg-(--lc-surface-2) px-2 py-1 text-xs text-(--lc-text-primary) outline-none placeholder:text-(--lc-text-muted)"
            placeholder="https://leetcode.com/problems/two-sum/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            className="mt-2 w-full border border-(--lc-border-default) bg-(--lc-surface-3) py-1 text-xs text-(--lc-text-primary) transition hover:border-(--lc-border-focus) hover:text-(--lc-accent) disabled:opacity-40"
            onClick={handleCreate}
            disabled={loading || url.trim() === ""}
          >
            {loading ? "Loading…" : "Create"}
          </button>
          {error && (
            <div className="mt-1 text-xs text-(--lc-danger)">{error}</div>
          )}
        </div>
      </div>
    );
  }

  // ── loaded: problem details ───────────────────────────────────────────────

  const { title, difficulty, content, tags, likes, dislikes, stats } =
    node.data;
  const parsedStats = parseStats(stats);

  return (
    <div
      ref={loadedRootRef}
      className={`${base} flex flex-col`}
      style={{ left: node.x, top: node.y, width: node.width, ...dragStyle }}
    >
      <NodeHeader
        title="Problem"
        Icon={IconPuzzle}
        onPointerDown={handleHeaderPointerDown}
      />

      <div className="p-3" onPointerDown={(e) => e.stopPropagation()}>
        <div className="mb-3">
          <h3 className="text-base font-semibold text-(--lc-text-primary)">
            {title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
            <span
              className={`rounded-full border border-current px-2 py-0.5 font-semibold ${difficultyClass(difficulty)}`}
            >
              {difficulty}
            </span>

            {tags.map((t) => (
              <span
                key={t.id}
                className="rounded-full border border-(--lc-border-default) px-2 py-0.5 text-[10px] text-(--lc-text-secondary)"
              >
                {t.name}
              </span>
            ))}
          </div>
        </div>

        {/* Render HTML content directly — safe since it's from our own DB */}
        <div
          className="mb-3 text-xs leading-relaxed text-(--lc-text-secondary) [&_a]:text-(--lc-link) [&_code]:bg-(--lc-surface-2) [&_code]:px-1 [&_code]:text-(--lc-text-secondary) [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-(--lc-surface-2) [&_pre]:p-2 [&_strong]:text-(--lc-text-primary) [&_ul]:list-disc [&_ul]:pl-4"
          dangerouslySetInnerHTML={{ __html: content }}
        />

        <div className="flex flex-wrap gap-3 text-[10px] text-(--lc-text-muted)">
          <span>▲ {likes}</span>
          <span>▼ {dislikes}</span>
          {parsedStats && <span>✓ {parsedStats.acRate}</span>}
        </div>
      </div>
    </div>
  );
}

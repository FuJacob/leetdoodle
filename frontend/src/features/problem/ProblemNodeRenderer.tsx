import { useCallback, useRef, useState } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import type {
  CanvasNode,
  NodeType,
  ProblemData,
  ProblemNode,
} from "../../shared/nodes";
import { extractSlug, parseStats, difficultyClass } from "./utils";
import { useNodeContentSizeSync } from "../../canvas/hooks/useNodeContentSizeSync";
import { NODE_CONTROL_OPTIONS } from "../../canvas/ui/controlOptions";

const LEETCODE_SERVICE = "http://localhost:8081";
const MIN_NODE_WIDTH = 100;
const MIN_NODE_HEIGHT = 80;

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

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);
  const handleAddNode = () => setShowAddNodePanel(true);
  const handleCloseAddNodePanel = () => setShowAddNodePanel(false);

  if (node.data.status === "empty" || node.data.status === "error") {
    const error = node.data.status === "error" ? node.data.message : null;
    return (
      <div
        className="w2k-window absolute cursor-grab select-none active:cursor-grabbing"
        style={{
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
          display: "flex",
          flexDirection: "column",
        }}
        onPointerDown={(e) => onPointerDown(e, node)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="w2k-titlebar" style={{ flexShrink: 0 }}>
          <span style={{ fontSize: 10 }}>🧩</span>
          <span>Problem</span>
        </div>
        <div
          style={{ padding: 6, flex: 1, minHeight: 0 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            className="w2k-input"
            style={{ width: "100%", fontSize: 11, boxSizing: "border-box" }}
            placeholder="https://leetcode.com/problems/two-sum/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            className="w2k-btn"
            style={{ marginTop: 6, width: "100%" }}
            onClick={handleCreate}
            disabled={loading || url.trim() === ""}
          >
            {loading ? "Loading..." : "Open"}
          </button>
          {error && (
            <div style={{ marginTop: 4, fontSize: 10, color: "var(--w2k-red)", fontFamily: '"MS Sans Serif", Tahoma, Arial, sans-serif' }}>
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  const { title, difficulty, content, tags, likes, dislikes, stats } = node.data;
  const parsedStats = parseStats(stats);

  const diffColor =
    difficulty === "Easy" ? "var(--w2k-green)" :
    difficulty === "Hard" ? "var(--w2k-red)" :
    "var(--w2k-yellow)";

  return (
    <div
      ref={loadedRootRef}
      className="w2k-window absolute cursor-grab select-none active:cursor-grabbing"
      style={{ left: node.x, top: node.y, width: node.width, display: "flex", flexDirection: "column" }}
      onPointerDown={(e) => onPointerDown(e, node)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Title bar */}
      <div className="w2k-titlebar" style={{ flexShrink: 0, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10 }}>🧩</span>
          <span>{title}</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: "normal", color: "#aaddff" }}>{difficulty}</span>
      </div>

      <div style={{ padding: "4px 6px 6px 6px", background: "var(--w2k-btn-face)" }}>
        {/* Difficulty badge */}
        <div style={{ marginBottom: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
          <span style={{
            display: "inline-block",
            padding: "0 6px",
            fontSize: 10,
            fontFamily: '"MS Sans Serif", Tahoma, Arial, sans-serif',
            color: "var(--w2k-white)",
            background: diffColor,
          }}>
            {difficulty}
          </span>
          {tags.map((t) => (
            <span
              key={t.id}
              className="w2k-statusbar"
              style={{ fontSize: 10, padding: "0 4px" }}
            >
              {t.name}
            </span>
          ))}
        </div>

        {/* Content — rendered HTML from LeetCode */}
        <div
          className="w2k-sunken"
          style={{
            padding: "4px 6px",
            maxHeight: 280,
            overflowY: "auto",
            background: "#ffffff",
            fontSize: 11,
            lineHeight: 1.5,
            fontFamily: '"MS Sans Serif", Tahoma, Arial, sans-serif',
            color: "var(--w2k-black)",
          }}
          onPointerDown={(e) => e.stopPropagation()}
          // Safe — content from our own DB
          dangerouslySetInnerHTML={{ __html: content }}
        />

        {/* Stats row */}
        <div style={{ marginTop: 4, display: "flex", gap: 8, fontSize: 10, fontFamily: '"MS Sans Serif", Tahoma, Arial, sans-serif', color: "var(--w2k-gray-text)" }}>
          <span>▲ {likes}</span>
          <span>▼ {dislikes}</span>
          {parsedStats && <span>✓ {parsedStats.acRate}</span>}
        </div>
      </div>

      {/* Hover add-node area */}
      <div
        className="absolute bottom-2 left-0 right-0 translate-y-full"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="h-1" />
        {isHovering && !showAddNodePanel && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="w2k-btn" style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 3 }} onClick={handleAddNode}>
              <IconPlus size={11} stroke={2} />
              Add node
            </button>
          </div>
        )}

        {showAddNodePanel && (
          <div
            className="w2k-window"
            style={{ marginTop: 4, padding: 6, position: "relative" }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseAddNodePanel}
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--w2k-gray-text)",
                fontSize: 11,
                lineHeight: 1,
                padding: 2,
              }}
              aria-label="Close add node panel"
            >
              <IconX size={11} stroke={2} />
            </button>
            <div style={{ display: "flex", gap: 4, paddingRight: 16 }}>
              {NODE_CONTROL_OPTIONS.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => {
                    onSpawn(type, node.id);
                    handleCloseAddNodePanel();
                  }}
                  className="w2k-btn"
                  style={{ fontSize: 10 }}
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

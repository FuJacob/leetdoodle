import { useMemo } from "react";
import type { CollabUser, RemoteStroke } from "./hooks/useCanvasCollab";
import type { Transform } from "./types";

interface Props {
  remoteStrokes: Map<string, RemoteStroke>;
  users: CollabUser[];
  transform: Transform;
}

const DEFAULT_STROKE_COLOR = "var(--lc-selection-remote-fallback)";

export function DrawingOverlay({ remoteStrokes, users, transform }: Props) {
  const usersById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-20"
      style={{ width: "100%", height: "100%" }}
    >
      {Array.from(remoteStrokes.entries()).map(([userId, stroke]) => {
        const { points, thickness } = stroke;
        if (points.length < 2) return null;
        const color = usersById.get(userId)?.color ?? DEFAULT_STROKE_COLOR;
        const pointsStr = points
          .map(
            ([x, y]) =>
              `${x * transform.zoom + transform.x},${y * transform.zoom + transform.y}`,
          )
          .join(" ");
        return (
          <polyline
            key={userId}
            points={pointsStr}
            fill="none"
            stroke={color}
            strokeWidth={thickness * transform.zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

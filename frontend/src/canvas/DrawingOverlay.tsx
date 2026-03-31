import { useMemo } from "react";
import type { CollabUser } from "./hooks/useCanvasCollab";
import type { Transform } from "./types";

interface Props {
  remoteStrokes: Map<string, Array<[number, number]>>;
  users: CollabUser[];
  transform: Transform;
}

const DEFAULT_STROKE_COLOR = "#3b82f6";

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
      {Array.from(remoteStrokes.entries()).map(([userId, points]) => {
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
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

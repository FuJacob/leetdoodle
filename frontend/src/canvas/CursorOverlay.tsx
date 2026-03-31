import { useMemo } from "react";
import type { CollabUser, RemoteCursor } from "./hooks/useCanvasCollab";
import type { Transform } from "./types";

interface Props {
  cursors: Map<string, RemoteCursor>;
  users: CollabUser[];
  transform: Transform;
}

const DEFAULT_CURSOR_COLOR = "#3b82f6";

export function CursorOverlay({ cursors, users, transform }: Props) {
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );

  return (
    <>
      {Array.from(cursors.values()).map(({ userId, x, y }) => {
        const sx = x * transform.zoom + transform.x;
        const sy = y * transform.zoom + transform.y;
        const color = usersById.get(userId)?.color ?? DEFAULT_CURSOR_COLOR;
        return (
          <div
            key={userId}
            className="pointer-events-none absolute z-30 flex items-start"
            style={{ left: sx, top: sy }}
          >
            <div className="rounded-full p-2" style={{ backgroundColor: color }} />
            <span
              className="ml-1 rounded px-1 py-0.5 text-[10px] leading-none text-white"
              style={{ backgroundColor: color }}
            >
              {userId.slice(0, 4)}
            </span>
          </div>
        );
      })}
    </>
  );
}

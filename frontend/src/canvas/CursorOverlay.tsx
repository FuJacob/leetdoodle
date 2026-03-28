import type { RemoteCursor } from "./hooks/useCanvasCollab";
import type { Transform } from "./types";

interface Props {
  cursors: Map<string, RemoteCursor>;
  transform: Transform;
}

export function CursorOverlay({ cursors, transform }: Props) {
  return (
    <>
      {Array.from(cursors.values()).map(({ userId, x, y }) => {
        const sx = x * transform.zoom + transform.x;
        const sy = y * transform.zoom + transform.y;
        return (
          <div
            key={userId}
            className="pointer-events-none absolute z-20 flex items-start"
            style={{ left: sx, top: sy }}
          >
            <div className="rounded-full p-2 bg-blue-500" />
            <span className="ml-1 rounded bg-blue-500 px-1 py-0.5 text-[10px] leading-none text-white">
              {userId.slice(0, 4)}
            </span>
          </div>
        );
      })}
    </>
  );
}

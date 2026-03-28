import type { RemoteCursor } from '../canvas/hooks/useCollabCursors';
import type { Transform } from '../canvas/types';

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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2L14 6L8 8L6 14L2 2Z" fill="#60a5fa" stroke="#1e3a5f" strokeWidth="1" />
            </svg>
            <span className="ml-1 rounded bg-blue-500 px-1 py-0.5 text-[10px] leading-none text-white">
              {userId.slice(0, 4)}
            </span>
          </div>
        );
      })}
    </>
  );
}

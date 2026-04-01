import { type RefObject, useEffect, useMemo, useState } from "react";
import type { CollabUser, RemoteCursor } from "./hooks/useCanvasCollab";
import type { LocalCursorMode, Transform } from "./types";
import resizeNeswCursorImage from "../assets/Cursor/Resize/North East South West.png";
import resizeNwseCursorImage from "../assets/Cursor/Resize/North West South East.png";

interface LocalCursor {
  x: number;
  y: number;
}

interface Props {
  cursors: Map<string, RemoteCursor>;
  users: CollabUser[];
  transform: Transform;
  viewportRef: RefObject<HTMLDivElement | null>;
  localCursorMode: LocalCursorMode;
}

const DEFAULT_CURSOR_COLOR = "var(--lc-selection-remote-fallback)";
const CURSOR_STROKE = "#ffffff";
const CURSOR_LABEL_CHARS = 4;
const CURSOR_TIP_OFFSET_X = 2;
const CURSOR_TIP_OFFSET_Y = 2;
const CURSOR_PATH =
  "M20.5056 10.7754C21.1225 10.5355 21.431 10.4155 21.5176 10.2459C21.5926 10.099 21.5903 9.92446 21.5115 9.77954C21.4205 9.61226 21.109 9.50044 20.486 9.2768L4.59629 3.5728C4.0866 3.38983 3.83175 3.29835 3.66514 3.35605C3.52029 3.40621 3.40645 3.52004 3.35629 3.6649C3.29859 3.8315 3.39008 4.08635 3.57304 4.59605L9.277 20.4858C9.50064 21.1088 9.61246 21.4203 9.77973 21.5113C9.92465 21.5901 10.0991 21.5924 10.2461 21.5174C10.4157 21.4308 10.5356 21.1223 10.7756 20.5054L13.3724 13.8278C13.4194 13.707 13.4429 13.6466 13.4792 13.5957C13.5114 13.5506 13.5508 13.5112 13.5959 13.479C13.6468 13.4427 13.7072 13.4192 13.828 13.3722L20.5056 10.7754Z";

const LOCAL_RESIZE_CURSOR_IMAGE_BY_MODE: Record<
  Exclude<LocalCursorMode, "pointer">,
  string
> = {
  "resize-nwse": resizeNwseCursorImage,
  "resize-nesw": resizeNeswCursorImage,
};

function CursorGlyph({
  x,
  y,
  fill,
  label,
  labelColor,
  zClassName = "z-[100]",
}: {
  x: number;
  y: number;
  fill: string;
  label?: string;
  labelColor?: string;
  zClassName?: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute flex items-start ${zClassName}`}
      style={{
        left: x - CURSOR_TIP_OFFSET_X,
        top: y - CURSOR_TIP_OFFSET_Y,
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 26 26"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d={CURSOR_PATH}
          fill={fill}
          stroke={CURSOR_STROKE}
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label && labelColor && (
        <span
          className="ml-1 rounded px-1 py-0.5 text-[10px] leading-none text-(--lc-text-inverse)"
          style={{ backgroundColor: labelColor }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export function CursorOverlay({
  cursors,
  users,
  transform,
  viewportRef,
  localCursorMode,
}: Props) {
  const [localCursor, setLocalCursor] = useState<LocalCursor | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateLocalCursor = (event: PointerEvent) => {
      const rect = viewport.getBoundingClientRect();
      setLocalCursor({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    const clearLocalCursor = () => {
      setLocalCursor(null);
    };

    viewport.addEventListener("pointermove", updateLocalCursor);
    viewport.addEventListener("pointerenter", updateLocalCursor);
    viewport.addEventListener("pointerleave", clearLocalCursor);
    window.addEventListener("blur", clearLocalCursor);

    return () => {
      viewport.removeEventListener("pointermove", updateLocalCursor);
      viewport.removeEventListener("pointerenter", updateLocalCursor);
      viewport.removeEventListener("pointerleave", clearLocalCursor);
      window.removeEventListener("blur", clearLocalCursor);
    };
  }, [viewportRef]);

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[200]">
      {Array.from(cursors.values()).map(({ userId, x, y }) => {
        const sx = x * transform.zoom + transform.x;
        const sy = y * transform.zoom + transform.y;
        const color = usersById.get(userId)?.color ?? DEFAULT_CURSOR_COLOR;
        return (
          <CursorGlyph
            key={userId}
            x={sx}
            y={sy}
            fill={color}
            label={userId.slice(0, CURSOR_LABEL_CHARS)}
            labelColor={color}
          />
        );
      })}
      {localCursor && (
        localCursorMode === "pointer" ? (
          <CursorGlyph
            x={localCursor.x}
            y={localCursor.y}
            fill="#000000"
            zClassName="z-[320]"
          />
        ) : (
          <img
            className="pointer-events-none absolute z-[320]"
            src={LOCAL_RESIZE_CURSOR_IMAGE_BY_MODE[localCursorMode]}
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{
              left: localCursor.x - CURSOR_TIP_OFFSET_X,
              top: localCursor.y - CURSOR_TIP_OFFSET_Y,
            }}
          />
        )
      )}
    </div>
  );
}

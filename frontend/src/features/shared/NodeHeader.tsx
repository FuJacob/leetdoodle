import type { ComponentType, ReactNode } from "react";

type HeaderIconProps = {
  className?: string;
  size?: number | string;
  stroke?: number | string;
};

interface Props {
  title: string;
  Icon: ComponentType<HeaderIconProps>;
  right?: ReactNode;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  className?: string;
  titleClassName?: string;
}

/**
 * Shared node header chrome so every node title reads consistently.
 *
 * Why a shared component?
 * Header styling and icon treatment were drifting across renderers. Centralizing
 * the shell keeps the visuals aligned while still letting each node supply its
 * own actions or drag behavior.
 */
export function NodeHeader({
  title,
  Icon,
  right,
  onPointerDown,
  className = "",
  titleClassName = "",
}: Props) {
  const dragClass = onPointerDown
    ? "cursor-grab select-none active:cursor-grabbing"
    : "";

  return (
    <div
      className={`flex items-center justify-between border-b border-(--lc-border-default) px-3 py-2 ${dragClass} ${className}`}
      onPointerDown={onPointerDown}
    >
      <div className="flex items-center gap-2">
        <Icon
          size={14}
          stroke={1.8}
          className="shrink-0 text-(--lc-text-muted)"
        />
        <span className={`text-xs font-semibold text-(--lc-text-secondary) ${titleClassName}`}>
          {title}
        </span>
      </div>
      {right}
    </div>
  );
}

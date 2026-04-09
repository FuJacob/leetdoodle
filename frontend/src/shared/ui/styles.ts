/**
 * Shared class recipes for Leetdoodle's rounded design system.
 *
 * Why constants instead of wrapper components?
 * Most of the UI already has good semantic component boundaries. Centralizing
 * the visual language as reusable class recipes lets those components keep
 * their markup while sharing one geometry, surface, and border system.
 */
export const SURFACE_SHELL_CLASS =
  "rounded-md border border-(--lc-border-default) bg-(--lc-surface-1)";

export const SURFACE_INSET_CLASS =
  "rounded-md border border-(--lc-border-default) bg-(--lc-surface-2)";

export const INTERACTIVE_CONTROL_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-md border border-(--lc-border-default) text-(--lc-text-secondary) transition hover:border-(--lc-border-focus) hover:text-(--lc-accent)";

export const BUTTON_CLASS =
  `${INTERACTIVE_CONTROL_CLASS} bg-(--lc-surface-2) px-3 py-1.5 text-sm`;

export const BUTTON_ACTIVE_CLASS =
  "border-(--lc-border-focus) bg-(--lc-surface-3) text-(--lc-accent)";

export const ICON_BUTTON_CLASS =
  `${INTERACTIVE_CONTROL_CLASS} h-9 w-9 bg-(--lc-surface-2)`;

export const TEXT_INPUT_CLASS =
  "w-full rounded-md border border-(--lc-border-default) bg-(--lc-surface-2) px-3 py-2 text-sm text-(--lc-text-primary) outline-none transition placeholder:text-(--lc-text-muted) focus:border-(--lc-border-focus)";

export const MICRO_LABEL_CLASS =
  "text-[10px] font-semibold uppercase tracking-[0.12em] text-(--lc-text-muted)";

export const ACTION_TRAY_CLASS = `${SURFACE_SHELL_CLASS} p-2`;

export const PILL_CLASS =
  "inline-flex items-center rounded-full border border-(--lc-border-default) px-2 py-0.5 text-[10px] font-medium text-(--lc-text-secondary)";

export const SEGMENTED_CONTROL_CLASS =
  `${SURFACE_INSET_CLASS} inline-flex items-center gap-1 p-1`;

export const SEGMENTED_OPTION_CLASS =
  "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm text-(--lc-text-secondary) transition hover:text-(--lc-accent)";

export const SEGMENTED_OPTION_ACTIVE_CLASS =
  "border border-(--lc-border-focus) bg-(--lc-surface-1) text-(--lc-text-primary)";

import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "../theme/useTheme";

export function ThemePanel() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex flex-col gap-2 border border-(--lc-border-default) bg-(--lc-surface-1) p-3">
      <div className="text-xs font-semibold text-(--lc-text-secondary)">Theme</div>
      <button
        type="button"
        aria-pressed={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={toggleTheme}
        className="flex items-center gap-2 border border-(--lc-border-default) bg-(--lc-surface-2) px-3 py-1.5 text-sm text-(--lc-text-secondary) transition hover:border-(--lc-border-focus) hover:text-(--lc-accent)"
      >
        {isDark ? <IconSun size={15} stroke={1.8} /> : <IconMoon size={15} stroke={1.8} />}
        <span>{isDark ? "Dark" : "Light"}</span>
      </button>
    </div>
  );
}

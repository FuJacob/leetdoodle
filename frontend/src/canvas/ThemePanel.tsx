import { IconMoon, IconSun } from "@tabler/icons-react";
import { CONTROL_ICON_SIZE, CONTROL_ICON_STROKE } from "./ui/controlOptions";
import { useTheme } from "../theme/useTheme";
import { BUTTON_CLASS, MICRO_LABEL_CLASS } from "../shared/ui/styles";

export function ThemePanel() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex items-center gap-2">
      <span className={MICRO_LABEL_CLASS}>Theme</span>
      <button
        type="button"
        aria-pressed={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={toggleTheme}
        className={BUTTON_CLASS}
      >
        {isDark ? (
          <IconSun size={CONTROL_ICON_SIZE} stroke={CONTROL_ICON_STROKE} />
        ) : (
          <IconMoon size={CONTROL_ICON_SIZE} stroke={CONTROL_ICON_STROKE} />
        )}
        <span>{isDark ? "Dark" : "Light"}</span>
      </button>
    </div>
  );
}

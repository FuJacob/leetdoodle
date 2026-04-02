import { useTheme } from "../theme/useTheme";

export function ThemePanel() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="w2k-window" style={{ minWidth: 110 }}>
      <div className="w2k-titlebar">
        <span style={{ fontSize: 10 }}>🎨</span>
        <span>Display</span>
      </div>
      <div style={{ padding: "6px" }}>
        <button
          type="button"
          aria-pressed={isDark}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
          className="w2k-btn"
          style={{ width: "100%" }}
        >
          {isDark ? "Light Mode" : "Dark Mode"}
        </button>
      </div>
    </div>
  );
}

export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "leetdoodle.theme.isDark";

function safeGetThemeFlag(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeSetThemeFlag(value: "0" | "1") {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // Ignore storage errors (e.g. private mode restrictions).
  }
}

export function readThemeModeFromStorage(): ThemeMode {
  if (typeof window === "undefined") return "light";

  const flag = safeGetThemeFlag();
  if (flag === "1") return "dark";
  if (flag === "0") return "light";
  return "light";
}

export function writeThemeModeToStorage(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  safeSetThemeFlag(mode === "dark" ? "1" : "0");
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", mode);
}

export function initializeThemeMode(): ThemeMode {
  const mode = readThemeModeFromStorage();
  applyThemeMode(mode);
  return mode;
}

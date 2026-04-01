import { useEffect, useMemo, useState } from "react";
import {
  applyThemeMode,
  readThemeModeFromStorage,
  writeThemeModeToStorage,
  type ThemeMode,
} from "./theme";
import { ThemeContext, type ThemeContextValue } from "./ThemeContext";

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: ThemeMode;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeMode>(
    initialTheme ?? readThemeModeFromStorage(),
  );

  useEffect(() => {
    applyThemeMode(theme);
    writeThemeModeToStorage(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((prev) => (prev === "light" ? "dark" : "light")),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

import { useContext } from "react";
import { ThemeContext, type ThemeContextValue } from "./ThemeContext";

/**
 * Reads the current theme controller from context.
 *
 * This is the single frontend entrypoint for reading theme state and invoking
 * theme actions such as toggling between light and dark modes.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

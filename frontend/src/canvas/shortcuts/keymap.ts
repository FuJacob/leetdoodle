const MODIFIER_KEYS = new Set(["control", "meta", "alt", "shift"]);

function normalizeEventKey(event: KeyboardEvent): string {
  const raw = event.key;
  if (raw === " ") return "space";
  const lowered = raw.toLowerCase();

  if (lowered === "escape") return "escape";
  if (lowered === "delete") return "delete";
  if (lowered === "backspace") return "backspace";

  return lowered;
}

function normalizeComboPart(part: string): string {
  const lowered = part.trim().toLowerCase();
  if (lowered === "cmd" || lowered === "command" || lowered === "ctrl") {
    return "mod";
  }
  if (lowered === "esc") return "escape";
  return lowered;
}

export function normalizeShortcutCombo(combo: string): string {
  const tokens = combo
    .split("+")
    .map(normalizeComboPart)
    .filter((token) => token.length > 0);

  const hasMod = tokens.includes("mod");
  const hasShift = tokens.includes("shift");
  const hasAlt = tokens.includes("alt");
  const key = tokens.find(
    (token) => token !== "mod" && token !== "shift" && token !== "alt",
  );

  if (!key) return "";

  const parts: string[] = [];
  if (hasMod) parts.push("mod");
  if (hasShift) parts.push("shift");
  if (hasAlt) parts.push("alt");
  parts.push(key);
  return parts.join("+");
}

export function eventToShortcutCombo(event: KeyboardEvent): string | null {
  const key = normalizeEventKey(event);
  if (MODIFIER_KEYS.has(key)) return null;

  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("mod");
  if (event.shiftKey) parts.push("shift");
  if (event.altKey) parts.push("alt");
  parts.push(key);

  return parts.join("+");
}

export function isEscapeCombo(combo: string): boolean {
  return combo === "escape";
}

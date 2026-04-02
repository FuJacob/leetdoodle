import { normalizeShortcutCombo } from "./keymap";
import type { ShortcutBinding, ShortcutContext, ShortcutScope } from "./types";

function isScopeAllowed(scope: ShortcutScope, context: ShortcutContext): boolean {
  switch (scope) {
    case "global":
      return true;
    case "canvas":
      return context.isCanvasEventTarget || context.isViewportFocused;
    case "selection":
      return (
        context.selectedNodeIds.size > 0 &&
        (context.isCanvasEventTarget || context.isViewportFocused)
      );
    default:
      return false;
  }
}

export class ShortcutRegistry {
  private bindings: ShortcutBinding[] = [];

  register(binding: ShortcutBinding): () => void {
    const normalizedCombos = binding.combos
      .map(normalizeShortcutCombo)
      .filter((combo) => combo.length > 0);

    const normalizedBinding: ShortcutBinding = {
      ...binding,
      combos: normalizedCombos,
    };

    this.bindings = [...this.bindings, normalizedBinding];

    return () => {
      this.bindings = this.bindings.filter((candidate) => candidate !== normalizedBinding);
    };
  }

  clear() {
    this.bindings = [];
  }

  resolve(
    combo: string,
    event: KeyboardEvent,
    context: ShortcutContext,
  ): ShortcutBinding | null {
    const ordered = [...this.bindings].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    );

    for (const binding of ordered) {
      if (!binding.combos.includes(combo)) continue;
      if (!binding.allowRepeat && event.repeat) continue;
      if (!isScopeAllowed(binding.scope, context)) continue;
      if (binding.enabled && !binding.enabled(context)) continue;
      return binding;
    }

    return null;
  }
}

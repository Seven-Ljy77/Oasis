// =============================================================================
// Mercury — Keyboard shortcut hook
//
// Registers a global (or scoped) keyboard handler. Modifiers are matched
// exactly; the callback fires on keydown.
// =============================================================================

import { useEffect } from "react";

export interface KeyboardModifiers {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/**
 * Register a keyboard shortcut handler.
 *
 * @param key        The KeyboardEvent.key value (e.g. "f", "Escape", "/")
 * @param modifiers  Required modifier keys (all must match)
 * @param callback   Called when the shortcut is pressed
 * @param disabled   When true, the shortcut is ignored
 *
 * @example
 * useKeyboardShortcut("/", { ctrl: true }, () => {
 *   console.log("Ctrl+/ pressed — focus search");
 * });
 */
export function useKeyboardShortcut(
  key: string,
  modifiers: KeyboardModifiers,
  callback: () => void,
  disabled: boolean = false,
): void {
  useEffect(() => {
    if (disabled) return;

    const handler = (e: KeyboardEvent) => {
      // Ignore events from input/textarea/select unless it's Escape
      const tag = (e.target as HTMLElement)?.tagName || "";
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (isEditable && key !== "Escape") return;

      const ctrl = modifiers.ctrl ?? false;
      const alt = modifiers.alt ?? false;
      const shift = modifiers.shift ?? false;
      const meta = modifiers.meta ?? false;

      const ctrlMatches =
        ctrl === (e.ctrlKey || e.metaKey); // treat Cmd as Ctrl on macOS
      const altMatches = alt === e.altKey;
      const shiftMatches = shift === e.shiftKey;
      const metaMatches = meta === e.metaKey;

      // For the "key" check: normalize for common aliases
      const eventKey = e.key;

      if (
        eventKey.toLowerCase() === key.toLowerCase() &&
        ctrlMatches &&
        altMatches &&
        shiftMatches &&
        metaMatches
      ) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, modifiers, callback, disabled]);
}

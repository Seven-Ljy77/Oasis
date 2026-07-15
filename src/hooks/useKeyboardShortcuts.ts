import { useCallback, useEffect } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useEntryStore } from "@/stores/useEntryStore";
import * as ipc from "@/lib/ipc";

/**
 * Returns true if the keyboard event originated from an editable element
 * (input, textarea, contenteditable). We skip all single-key shortcuts in
 * those cases so normal typing isn't hijacked.
 */
function isEditableTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts() {
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const increaseFontScale = useAppStore((s) => s.increaseFontScale);
  const decreaseFontScale = useAppStore((s) => s.decreaseFontScale);
  const toggleUnreadOnly = useAppStore((s) => s.toggleUnreadOnly);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // ------------------------------------------------------------------
      // Modifier-based shortcuts (Ctrl / Cmd)
      // ------------------------------------------------------------------

      // Ctrl+F / Cmd+F: Open search
      if (mod && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      // Ctrl+D / Cmd+D: Toggle star on selected entry
      if (mod && e.key === "d") {
        e.preventDefault();
        const { entries, selectedEntryId, markStarred } =
          useEntryStore.getState();
        if (selectedEntryId !== null) {
          const entry = entries.find((en) => en.id === selectedEntryId);
          if (entry) {
            markStarred(entry.id, !entry.is_starred);
          }
        }
        return;
      }

      // Ctrl+= / Ctrl+-: Font scale
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        increaseFontScale();
        return;
      }

      if (mod && e.key === "-") {
        e.preventDefault();
        decreaseFontScale();
        return;
      }

      // ------------------------------------------------------------------
      // Single-key shortcuts — skip when focus is in an editable field
      // ------------------------------------------------------------------
      if (isEditableTarget(e)) return;

      // Escape: Close search
      if (e.key === "Escape") {
        setSearchOpen(false);
        return;
      }

      // J: Next entry
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        const { entries, selectedEntryId, selectEntry } =
          useEntryStore.getState();
        if (entries.length === 0) return;
        const idx = entries.findIndex((en) => en.id === selectedEntryId);
        if (idx < entries.length - 1) {
          selectEntry(entries[idx + 1].id);
        }
        return;
      }

      // K: Previous entry
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        const { entries, selectedEntryId, selectEntry } =
          useEntryStore.getState();
        if (entries.length === 0) return;
        const idx = entries.findIndex((en) => en.id === selectedEntryId);
        if (idx > 0) {
          selectEntry(entries[idx - 1].id);
        }
        return;
      }

      // M: Toggle read / unread
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        const { entries, selectedEntryId, markRead } =
          useEntryStore.getState();
        if (selectedEntryId !== null) {
          const entry = entries.find((en) => en.id === selectedEntryId);
          if (entry) {
            markRead([entry.id], !entry.is_read);
          }
        }
        return;
      }

      // U: Toggle unread-only filter
      if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        toggleUnreadOnly();
        return;
      }

      // S: Toggle star on selected entry (same action as Ctrl+D)
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        const { entries, selectedEntryId, markStarred } =
          useEntryStore.getState();
        if (selectedEntryId !== null) {
          const entry = entries.find((en) => en.id === selectedEntryId);
          if (entry) {
            markStarred(entry.id, !entry.is_starred);
          }
        }
        return;
      }

      // V: Open entry URL in external browser
      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        const { entries, selectedEntryId } = useEntryStore.getState();
        if (selectedEntryId !== null) {
          const entry = entries.find((en) => en.id === selectedEntryId);
          if (entry?.url) {
            ipc.openInBrowser(entry.url);
          }
        }
        return;
      }
    },
    [setSearchOpen, increaseFontScale, decreaseFontScale, toggleUnreadOnly],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

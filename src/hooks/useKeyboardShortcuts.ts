import { useCallback, useEffect } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useEntryStore } from "@/stores/useEntryStore";

export function useKeyboardShortcuts() {
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const increaseFontScale = useAppStore((s) => s.increaseFontScale);
  const decreaseFontScale = useAppStore((s) => s.decreaseFontScale);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;

    // Ctrl+F / Cmd+F: Open search
    if (mod && e.key === "f") {
      e.preventDefault();
      setSearchOpen(true);
    }

    // Ctrl+D / Cmd+D: Toggle star on selected entry
    if (mod && e.key === "d") {
      e.preventDefault();
      const { entries, selectedEntryId, markStarred } = useEntryStore.getState();
      if (selectedEntryId !== null) {
        const entry = entries.find((en) => en.id === selectedEntryId);
        if (entry) {
          markStarred(entry.id, !entry.is_starred);
        }
      }
    }

    // Ctrl+= / Ctrl+-: Font scale
    if (mod && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      increaseFontScale();
    }

    if (mod && e.key === "-") {
      e.preventDefault();
      decreaseFontScale();
    }

    // Escape: Close search
    if (e.key === "Escape") {
      setSearchOpen(false);
    }
  }, [setSearchOpen, increaseFontScale, decreaseFontScale]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

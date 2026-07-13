import { useEffect } from "react";
import { useAppStore } from "@/stores/useAppStore";

export function useKeyboardShortcuts() {
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const increaseFontScale = useAppStore((s) => s.increaseFontScale);
  const decreaseFontScale = useAppStore((s) => s.decreaseFontScale);
  const fontScale = useAppStore((s) => s.fontScale);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl+F / Cmd+F: Open search
      if (mod && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
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
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setSearchOpen, increaseFontScale, decreaseFontScale, fontScale]);
}

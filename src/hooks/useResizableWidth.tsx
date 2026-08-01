import { useRef, useEffect, useCallback } from "react";

export function useResizableWidth(
  side: "left" | "right",
  storageKey: string,
  defaultWidth: number = 280,
  minWidth: number = 150,
  maxWidth: number = 600,
) {
  const panelRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef(defaultWidth);

  // Restore saved width on mount.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    let w = defaultWidth;
    try {
      const raw = localStorage.getItem(`panel-width-${storageKey}`);
      if (raw) {
        const parsed = parseInt(raw);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          w = parsed;
        }
      }
    } catch { /* ignore corrupt localStorage */ }
    savedRef.current = w;
    el.style.width = `${w}px`;
  }, [storageKey, defaultWidth, minWidth, maxWidth]);

  // Restore width when expanding from collapsed state.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    // If the panel was hidden (w-0), restore the last known width.
    if (el.offsetWidth === 0 && savedRef.current > 0) {
      el.style.width = `${savedRef.current}px`;
    }
  });

  // Persist width on window close.
  useEffect(() => {
    const onBeforeUnload = () => {
      const el = panelRef.current;
      if (el && el.offsetWidth > 0) {
        try { localStorage.setItem(`panel-width-${storageKey}`, String(el.offsetWidth)); } catch {}
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [storageKey]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    const handle = e.currentTarget;
    if (!panel) return;

    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startW = panel.offsetWidth;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const w = side === "left"
        ? Math.max(minWidth, Math.min(maxWidth, startW + dx))
        : Math.max(minWidth, Math.min(maxWidth, startW - dx));
      panel.style.width = `${w}px`;
    };

    const onUp = () => {
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      const w = panel.offsetWidth;
      if (w > 0) {
        savedRef.current = w;
        try { localStorage.setItem(`panel-width-${storageKey}`, String(w)); } catch {}
      }
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }, [side, storageKey, minWidth, maxWidth]);

  const dragHandle = (
    <div
      onPointerDown={onPointerDown}
      className="w-1.5 cursor-col-resize bg-slate-200 hover:bg-accent flex-shrink-0"
      title="Drag to resize"
      style={{ touchAction: "none" }}
    />
  );

  return { panelRef, dragHandle };
}

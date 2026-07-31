import { useRef, useLayoutEffect, useCallback } from "react";

export function useResizableWidth(
  side: "left" | "right",
  storageKey: string,
  defaultWidth: number = 280,
  minWidth: number = 150,
  maxWidth: number = 600,
) {
  const panelRef = useRef<HTMLDivElement>(null);

  // useLayoutEffect fires before paint — no flash of default width.
  useLayoutEffect(() => {
    if (!panelRef.current) return;
    let resolved = defaultWidth;
    try {
      const saved = localStorage.getItem(`panel-width-${storageKey}`);
      if (saved) {
        const w = parseInt(saved);
        if (w >= minWidth && w <= maxWidth) {
          resolved = w;
        }
      }
    } catch { /* ignore corrupt localStorage */ }
    panelRef.current.style.width = `${resolved}px`;
  }, [storageKey, defaultWidth, minWidth, maxWidth]);

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
      try {
        localStorage.setItem(`panel-width-${storageKey}`, String(panel.offsetWidth));
      } catch {}
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }, [side, storageKey]);

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

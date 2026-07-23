import { useRef, useEffect, useCallback } from "react";

export function useResizableWidth(side: "left" | "right", storageKey: string, defaultWidth: number = 280) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelRef.current) return;
    try {
      const saved = localStorage.getItem(`panel-width-${storageKey}`);
      if (saved) {
        const w = parseInt(saved);
        if (w >= 100 && w <= 800) {
          panelRef.current.style.width = `${w}px`;
          return;
        }
      }
    } catch {}
    panelRef.current.style.width = `${defaultWidth}px`;
  }, [storageKey, defaultWidth]);

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
        ? Math.max(100, Math.min(800, startW + dx))
        : Math.max(100, Math.min(800, startW - dx));
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

import { useRef, useEffect, useCallback } from "react";

export function useResizableHeight(storageKey: string, defaultHeight: number = 200) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Restore saved height on mount
  useEffect(() => {
    if (!panelRef.current) return;
    try {
      const saved = localStorage.getItem(`panel-height-${storageKey}`);
      if (saved) {
        const h = parseInt(saved);
        if (h >= 80 && h <= 600) {
          panelRef.current.style.height = `${h}px`;
          return;
        }
      }
    } catch {}
    panelRef.current.style.height = `${defaultHeight}px`;
  }, [storageKey, defaultHeight]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    const handle = e.currentTarget;
    if (!panel) return;

    handle.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startH = panel.offsetHeight;

    const onMove = (ev: PointerEvent) => {
      const h = Math.max(80, Math.min(600, startH + startY - ev.clientY));
      panel.style.height = `${h}px`;
    };

    const onUp = () => {
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      // Save height
      try {
        localStorage.setItem(`panel-height-${storageKey}`, String(panel.offsetHeight));
      } catch {}
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }, [storageKey]);

  const dragHandle = (
    <div
      onPointerDown={onPointerDown}
      className="h-1.5 cursor-ns-resize bg-slate-200 hover:bg-accent flex-shrink-0"
      title="Drag to resize"
      style={{ touchAction: "none" }}
    />
  );

  return { panelRef, dragHandle };
}

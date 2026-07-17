import { useState, useRef, useCallback } from "react";

export function useResizableHeight(defaultHeight: number = 200) {
  const [height, setHeight] = useState(defaultHeight);
  const resizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    resizing.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [height]);

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizing.current) return;
    const delta = startY.current - e.clientY;
    const newHeight = Math.max(80, Math.min(600, startHeight.current + delta));
    setHeight(newHeight);
  };

  const handleMouseUp = () => {
    resizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const dragHandle = (
    <div
      onMouseDown={handleMouseDown}
      className="h-2 cursor-ns-resize bg-slate-300 hover:bg-accent transition-colors flex-shrink-0 rounded"
      title="Drag to resize"
    />
  );

  return { height, dragHandle };
}

// =============================================================================
// Mercury — SplitPane component (horizontal split with draggable divider)
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from "react";

export interface SplitPaneProps {
  /** Minimum width for the left pane (px) */
  minLeft?: number;
  /** Minimum width for the right pane (px) */
  minRight?: number;
  /** Initial width of the left pane (px) */
  defaultLeftWidth?: number;
  /** Two child elements: [left, right] */
  children: [React.ReactNode, React.ReactNode];
  /** Additional CSS classes */
  className?: string;
  /** Called after each resize */
  onResize?: (leftWidth: number) => void;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  minLeft = 200,
  minRight = 200,
  defaultLeftWidth = 400,
  children,
  className = "",
  onResize,
}) => {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const maxLeft = containerRect.width - minRight;
      const clamped = Math.max(minLeft, Math.min(newWidth, maxLeft));
      setLeftWidth(clamped);
      onResize?.(clamped);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [minRight, minLeft, onResize]);

  const [leftChild, rightChild] = children;

  return (
    <div
      ref={containerRef}
      className={["flex flex-1 overflow-hidden", className].join(" ")}
    >
      {/* Left pane */}
      <div style={{ width: leftWidth, flexShrink: 0, overflow: "hidden" }}>
        {leftChild}
      </div>

      {/* Draggable divider */}
      <div
        className="group relative flex-shrink-0 w-1 cursor-col-resize bg-border hover:bg-accent-muted transition-colors"
        onMouseDown={startDrag}
      >
        {/* Invisible wider hit area */}
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* Right pane */}
      <div className="flex-1 overflow-hidden">{rightChild}</div>
    </div>
  );
};

export default SplitPane;

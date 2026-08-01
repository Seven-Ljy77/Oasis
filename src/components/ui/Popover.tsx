import React, { useEffect, useRef, useState } from "react";

interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  side?: "bottom" | "right" | "left" | "top";
  align?: "start" | "center" | "end";
  width?: string;
}

const Popover: React.FC<PopoverProps> = ({
  trigger,
  children,
  side = "bottom",
  align = "start",
  width = "auto",
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const alignClass = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  }[align];

  const sideClass = {
    bottom: "top-full mt-1",
    top: "bottom-full mb-1",
    left: "right-full mr-1",
    right: "left-full ml-1",
  }[side];

  return (
    <div ref={containerRef} className="relative inline-flex">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={`absolute z-[90] ${sideClass} ${alignClass} bg-surface border border-border rounded-lg shadow-lg`}
          style={{ width }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default Popover;

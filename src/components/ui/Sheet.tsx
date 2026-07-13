// =============================================================================
// Mercury — Sheet (slide-over panel) component
// =============================================================================

import React, { useEffect } from "react";

export type SheetSide = "left" | "right";

export interface SheetProps {
  /** Whether the sheet is visible */
  open: boolean;
  /** Called when the sheet should close */
  onClose: () => void;
  /** Sheet title (rendered in the header) */
  title?: string;
  /** Slide from left or right */
  side?: SheetSide;
  /** Content width */
  width?: string;
  /** Maximum width (prevents overflow on small screens) */
  maxWidth?: string;
  /** Sheet body content */
  children: React.ReactNode;
  /** Additional CSS class for the panel */
  className?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  side = "right",
  width = "560px",
  maxWidth = "90vw",
  children,
  className = "",
}) => {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const isRight = side === "right";

  return (
    <div
      className="fixed inset-0 z-[100] flex"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className={[
          "relative h-full bg-white shadow-xl border-border",
          "flex flex-col",
          "animate-in",
          isRight
            ? "ml-auto slide-in-from-right border-l"
            : "mr-auto slide-in-from-left border-r",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ width, maxWidth }}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between flex-shrink-0 px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 hover:bg-surface-tertiary hover:text-slate-600 transition-colors"
              aria-label="Close"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};

export default Sheet;

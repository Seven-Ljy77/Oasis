// =============================================================================
// Mercury — Dialog (modal) component
// =============================================================================

import React, { useEffect, useRef } from "react";
import { Button } from "./Button";

export interface DialogProps {
  /** Whether the dialog is visible */
  open: boolean;
  /** Called when the dialog should close (backdrop click, Escape) */
  onClose: () => void;
  /** Dialog title */
  title: string;
  /** Dialog body content */
  children: React.ReactNode;
  /** Action buttons rendered in the footer */
  actions?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary" | "danger";
    loading?: boolean;
    disabled?: boolean;
  }[];
  /** Maximum width class */
  maxWidth?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = "max-w-md",
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className={[
          "relative w-full rounded-xl border border-border bg-white shadow-xl",
          "animate-in fade-in zoom-in-95",
          maxWidth,
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2
            id="dialog-title"
            className="text-base font-semibold text-slate-900"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 text-sm text-slate-700">{children}</div>

        {/* Footer actions */}
        {actions && actions.length > 0 && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
            {actions.map((action) => (
              <Button
                key={action.label}
                variant={action.variant ?? "secondary"}
                size="sm"
                loading={action.loading}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

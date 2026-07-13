// =============================================================================
// Mercury — Toggle (switch) component
// =============================================================================

import React, { forwardRef } from "react";

export interface ToggleProps {
  /** Current checked state */
  checked: boolean;
  /** Change handler */
  onChange: (checked: boolean) => void;
  /** Label text displayed beside the toggle */
  label?: string;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ checked, onChange, label, disabled = false, className = "" }, ref) => {
    return (
      <label
        className={[
          "inline-flex items-center gap-2.5",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          className,
        ].join(" ")}
      >
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={[
            "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-muted focus-visible:ring-offset-1",
            checked ? "bg-accent" : "bg-slate-300",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
              checked ? "translate-x-[18px]" : "translate-x-[3px]",
            ].join(" ")}
          />
        </button>

        {label && (
          <span className="text-sm text-slate-700 select-none">{label}</span>
        )}
      </label>
    );
  },
);

Toggle.displayName = "Toggle";

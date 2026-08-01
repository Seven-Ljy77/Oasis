// =============================================================================
// Mercury — Select component
// =============================================================================

import React, { forwardRef, useState, useRef, useEffect } from "react";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  /** Currently selected value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Available options */
  options: SelectOption[];
  /** Label rendered above the select */
  label?: string;
  /** Placeholder shown when no value is selected */
  placeholder?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Additional CSS classes */
  className?: string;
}

export const Select = forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      value,
      onChange,
      options,
      label,
      placeholder = "Select...",
      disabled = false,
      error,
      className = "",
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selected = options.find((o) => o.value === value);

    // Close on outside click
    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
      <div ref={ref || containerRef} className="flex flex-col gap-1 relative">
        {label && (
          <span className="text-xs font-medium text-slate-600">{label}</span>
        )}

        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={[
            "flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
            "bg-white text-left",
            disabled
              ? "cursor-not-allowed opacity-50 bg-slate-50"
              : "cursor-pointer hover:border-slate-300",
            error ? "border-red-400" : "border-border",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className={selected ? "text-slate-900" : "text-slate-400"}>
            {selected?.label ?? placeholder}
          </span>
          <svg
            className={[
              "h-4 w-4 flex-shrink-0 text-slate-400 transition-transform",
              open ? "rotate-180" : "",
            ].join(" ")}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {open && (
          <ul className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-white py-1 shadow-lg">
            {options.map((opt) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={[
                  "cursor-pointer px-3 py-1.5 text-sm transition-colors",
                  opt.value === value
                    ? "bg-accent-muted text-accent font-medium"
                    : "text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";

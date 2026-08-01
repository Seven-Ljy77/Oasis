// =============================================================================
// Mercury — Input component
// =============================================================================

import React, { forwardRef, useState } from "react";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Error message (renders below the input) */
  error?: string;
  /** Optional icon rendered before the input */
  prefixIcon?: React.ReactNode;
  /** Show a clear (x) button when value is non-empty */
  clearable?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Label text rendered above the input */
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      value,
      onChange,
      placeholder,
      error,
      prefixIcon,
      clearable = false,
      className = "",
      label,
      id,
      ...rest
    },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);
    const inputId = id || (label ? `input-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);

    const handleClear = () => {
      // Synthesise a change event with empty value
      const synthetic = {
        target: { value: "" },
        currentTarget: { value: "" },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(synthetic);
    };

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-slate-600"
          >
            {label}
          </label>
        )}

        <div
          className={[
            "flex items-center gap-2 rounded-md border px-3 py-1.5 transition-colors",
            "bg-white",
            focused
              ? "border-border-focus ring-1 ring-accent-muted"
              : "border-border",
            error ? "border-red-400 ring-1 ring-red-100" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {prefixIcon && (
            <span className="flex-shrink-0 text-slate-400">{prefixIcon}</span>
          )}

          <input
            ref={ref}
            id={inputId}
            type="text"
            value={value}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
            {...rest}
          />

          {clearable && value.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="flex-shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Clear input"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

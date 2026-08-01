// =============================================================================
// Mercury — SearchField component
// =============================================================================

import React, { useRef, useEffect } from "react";

export interface SearchFieldProps {
  /** Current search text */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Called when Escape is pressed */
  onClose?: () => void;
  /** Whether to auto-focus on mount */
  autoFocus?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Search input with search icon, clear button, and keyboard shortcut hint.
 *
 * Typically rendered as an overlay bar at the top of the app.
 */
export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  placeholder = "Search entries...",
  onClose,
  autoFocus = true,
  className = "",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (value.length > 0) {
        onChange("");
      } else {
        onClose?.();
      }
    }
  };

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div
      className={[
        "flex items-center gap-3 bg-surface border-b border-border px-4 py-2.5",
        className,
      ].join(" ")}
    >
      {/* Search icon */}
      <svg
        className="h-4 w-4 flex-shrink-0 text-slate-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
      />

      {/* Clear button (visible when there is text) */}
      {value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="flex-shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label="Clear search"
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

      {/* Keyboard shortcut hint */}
      <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
        <span className="text-slate-500">Ctrl</span>
        <span>+</span>
        <span className="text-slate-500">F</span>
      </kbd>

      {/* Close button */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 rounded px-2 py-0.5 text-xs text-slate-400 border border-border hover:bg-surface-tertiary hover:text-slate-600 transition-colors"
          aria-label="Close search"
        >
          Esc
        </button>
      )}
    </div>
  );
};

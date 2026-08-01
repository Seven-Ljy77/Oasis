// =============================================================================
// Mercury — ReadingModePicker (segmented control for reading mode)
// =============================================================================

import React from "react";
import { useI18n } from "@/lib/i18n";
import type { ReadingMode } from "@/lib/types";

export interface ReadingModePickerProps {
  /** Current reading mode */
  value: ReadingMode;
  /** Called when mode changes */
  onChange: (mode: ReadingMode) => void;
  /** Additional CSS classes */
  className?: string;
}

interface ModeOption {
  value: ReadingMode;
  label: string;
  icon: React.ReactNode;
}

const ReadingModePicker: React.FC<ReadingModePickerProps> = ({
  value,
  onChange,
  className = "",
}) => {
  const { t } = useI18n();

  const modes: ModeOption[] = [
    {
      value: "reader",
      label: t.reader.reader,
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      ),
    },
    {
      value: "web",
      label: t.reader.web,
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
          />
        </svg>
      ),
    },
    {
      value: "dual",
      label: t.reader.dual,
      icon: (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
      ),
    },
  ];

  return (
    <div
      data-component="ReadingModePicker"
      className={`inline-flex items-center gap-0.5 bg-surface-tertiary rounded-lg p-0.5 ${className}`}
      role="radiogroup"
      aria-label="Reading mode"
    >
      {modes.map((mode) => {
        const isActive = value === mode.value;
        return (
          <button
            key={mode.value}
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(mode.value)}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
              isActive
                ? "bg-surface text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            title={mode.label}
          >
            {mode.icon}
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ReadingModePicker;

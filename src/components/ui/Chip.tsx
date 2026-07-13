// =============================================================================
// Mercury — Chip (tag pill) component
// =============================================================================

import React from "react";

export type ChipColor =
  | "default"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "purple";

export type ChipSize = "sm" | "md";

export interface ChipProps {
  /** Text label */
  label: string;
  /** Called when the remove (x) button is clicked. If omitted, no remove button is shown. */
  onRemove?: () => void;
  /** Color variant */
  color?: ChipColor;
  /** Size preset */
  size?: ChipSize;
  /** Additional CSS classes */
  className?: string;
}

const colorClasses: Record<ChipColor, string> = {
  default: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
};

const sizeClasses: Record<ChipSize, string> = {
  sm: "px-1.5 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
};

export const Chip: React.FC<ChipProps> = ({
  label,
  onRemove,
  color = "default",
  size = "md",
  className = "",
}) => {
  return (
    <span
      data-component="Chip"
      className={[
        "inline-flex items-center gap-1 rounded-full font-medium transition-colors",
        colorClasses[color],
        sizeClasses[size],
        className,
      ].join(" ")}
    >
      {label}

      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={[
            "flex-shrink-0 rounded-full p-0.5 transition-colors",
            "hover:bg-black/10 focus-visible:outline-none focus-visible:ring-1",
          ].join(" ")}
          aria-label={`Remove ${label}`}
        >
          <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </span>
  );
};

// =============================================================================
// Mercury — Badge (inline count / status) component
// =============================================================================

import React from "react";
import { MAX_BADGE_COUNT } from "@/lib/constants";

export type BadgeVariant = "default" | "secondary" | "danger" | "warning";

export interface BadgeProps {
  /** The count or text to display */
  children?: React.ReactNode;
  /** Numeric count — if provided, the badge caps display at MAX_BADGE_COUNT */
  count?: number;
  /** Visual variant */
  variant?: BadgeVariant;
  /** Max count before showing "9999+" */
  max?: number;
  /** Additional CSS classes */
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-accent text-white",
  secondary: "bg-surface-secondary text-slate-600 border border-border",
  danger: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  count,
  variant = "default",
  max = MAX_BADGE_COUNT,
  className = "",
}) => {
  const display =
    count !== undefined
      ? count > max
        ? `${max}+`
        : String(count)
      : children;

  if (display === undefined || display === null || display === "") return null;

  return (
    <span
      data-component="Badge"
      className={[
        "inline-flex items-center justify-center rounded-full px-1.5 py-px text-[10px] font-semibold leading-none",
        variantClasses[variant],
        className,
      ].join(" ")}
    >
      {display}
    </span>
  );
};

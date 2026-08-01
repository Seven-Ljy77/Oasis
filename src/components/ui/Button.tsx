// =============================================================================
// Mercury — Button component
// =============================================================================

import React, { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size preset */
  size?: ButtonSize;
  /** Show a spinner and disable interaction */
  loading?: boolean;
  /** Children (text, icon, etc.) */
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover focus-visible:ring-accent-muted",
  secondary:
    "bg-surface-secondary text-slate-700 border border-border hover:bg-surface-tertiary focus-visible:ring-accent-muted",
  ghost:
    "bg-transparent text-slate-600 hover:bg-surface-tertiary focus-visible:ring-accent-muted",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-200",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1 rounded",
  md: "h-8 px-3 text-sm gap-1.5 rounded-md",
  lg: "h-10 px-4 text-sm gap-2 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      className = "",
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          "inline-flex items-center justify-center font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {loading && <ButtonSpinner />}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

/** Tiny inline spinner for the loading state */
const ButtonSpinner: React.FC = () => (
  <svg
    className="h-3.5 w-3.5 animate-spin"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

export default Button;

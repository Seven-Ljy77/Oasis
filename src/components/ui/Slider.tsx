// =============================================================================
// Mercury — Slider component
// =============================================================================

import React, { forwardRef } from "react";

export interface SliderProps {
  /** Current value */
  value: number;
  /** Change handler */
  onChange: (value: number) => void;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Step increment */
  step?: number;
  /** Label rendered above the slider */
  label?: string;
  /** Show the numeric value beside the label */
  showValue?: boolean;
  /** Whether the slider is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      value,
      onChange,
      min,
      max,
      step = 1,
      label,
      showValue = true,
      disabled = false,
      className = "",
    },
    ref,
  ) => {
    const percentage = max > min ? ((value - min) / (max - min)) * 100 : 0;

    return (
      <div className={["flex flex-col gap-1.5", className].join(" ")}>
        {(label || showValue) && (
          <div className="flex items-center justify-between">
            {label && (
              <span className="text-xs font-medium text-slate-600">
                {label}
              </span>
            )}
            {showValue && (
              <span className="text-xs tabular-nums text-slate-400">
                {value}
              </span>
            )}
          </div>
        )}

        <div className="relative h-6 w-full flex items-center">
          {/* Track background */}
          <div className="absolute h-1.5 w-full rounded-full bg-slate-200" />

          {/* Filled track */}
          <div
            className="absolute h-1.5 rounded-full bg-accent transition-all"
            style={{ width: `${percentage}%` }}
          />

          {/* Native range input (invisible, overlays the track) */}
          <input
            ref={ref}
            type="range"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className={[
              "relative h-6 w-full appearance-none bg-transparent",
              "cursor-pointer",
              disabled ? "cursor-not-allowed opacity-50" : "",
              // Thumb styles for WebKit & Firefox
              "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer",
              "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-pointer",
              "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110",
            ].join(" ")}
          />
        </div>
      </div>
    );
  },
);

Slider.displayName = "Slider";

import React from "react";
import { useReaderStore } from "@/stores/useReaderStore";
import type { ThemePreset, ThemeMode } from "@/lib/types";
import Button from "@/components/ui/Button";

const ReaderThemePanel: React.FC = () => {
  const themePreset = useReaderStore((s) => s.themePreset);
  const setThemePreset = useReaderStore((s) => s.setThemePreset);
  const themeMode = useReaderStore((s) => s.themeMode);
  const setThemeMode = useReaderStore((s) => s.setThemeMode);
  const fontFamily = useReaderStore((s) => s.fontFamily);
  const setFontFamily = useReaderStore((s) => s.setFontFamily);
  const fontSize = useReaderStore((s) => s.fontSize);
  const setFontSize = useReaderStore((s) => s.setFontSize);
  const lineHeight = useReaderStore((s) => s.lineHeight);
  const setLineHeight = useReaderStore((s) => s.setLineHeight);
  const contentWidth = useReaderStore((s) => s.contentWidth);
  const setContentWidth = useReaderStore((s) => s.setContentWidth);
  const resetTheme = useReaderStore((s) => s.resetTheme);
  const quickStyle = useReaderStore((s) => s.quickStyle);
  const setQuickStyle = useReaderStore((s) => s.setQuickStyle);

  const fontFamilies = [
    { value: "system-ui", label: "System Default" },
    { value: "'Merriweather', Georgia, serif", label: "Merriweather" },
    { value: "'Inter', system-ui, sans-serif", label: "Inter" },
    { value: "'JetBrains Mono', monospace", label: "JetBrains Mono" },
  ];

  const quickStyles: { value: "none" | "warm" | "cool" | "slate"; label: string }[] = [
    { value: "none", label: "None" },
    { value: "warm", label: "Warm" },
    { value: "cool", label: "Cool" },
    { value: "slate", label: "Slate" },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Theme preset */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Theme Preset
        </label>
        <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5">
          {(["classic", "paper"] as ThemePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => setThemePreset(preset)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                themePreset === preset
                  ? "bg-surface text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Appearance mode */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Appearance
        </label>
        <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5">
          {(["auto", "forceLight", "forceDark"] as ThemeMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setThemeMode(mode)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                themeMode === mode
                  ? "bg-surface text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {mode === "auto" ? "Auto" : mode === "forceLight" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
      </div>

      {/* Quick style */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Quick Style
        </label>
        <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5">
          {quickStyles.map((style) => (
            <button
              key={style.value}
              onClick={() => setQuickStyle(style.value)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                quickStyle === style.value
                  ? "bg-surface text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font family */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Font Family
        </label>
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          className="w-full h-8 px-2 text-xs rounded-md border border-border bg-surface focus:border-accent focus:outline-none"
        >
          {fontFamilies.map((ff) => (
            <option key={ff.value} value={ff.value}>
              {ff.label}
            </option>
          ))}
        </select>
      </div>

      {/* Font size stepper */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Font Size
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFontSize(Math.max(12, fontSize - 1))}
            className="w-7 h-7 rounded border border-border flex items-center justify-center text-slate-600 hover:bg-surface-tertiary transition-colors text-sm"
          >
            -
          </button>
          <span className="text-sm text-slate-700 min-w-[3ch] text-center font-medium">
            {fontSize}
          </span>
          <button
            onClick={() => setFontSize(Math.min(28, fontSize + 1))}
            className="w-7 h-7 rounded border border-border flex items-center justify-center text-slate-600 hover:bg-surface-tertiary transition-colors text-sm"
          >
            +
          </button>
          <span className="text-xs text-slate-400 ml-1">px</span>
        </div>
      </div>

      {/* Line height slider */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Line Height: {lineHeight.toFixed(1)}
        </label>
        <input
          type="range"
          min="1.2"
          max="2.5"
          step="0.05"
          value={lineHeight}
          onChange={(e) => setLineHeight(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
        />
        <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
          <span>1.2</span>
          <span>2.5</span>
        </div>
      </div>

      {/* Content width slider */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Content Width: {contentWidth}rem
        </label>
        <input
          type="range"
          min="28"
          max="56"
          step="1"
          value={contentWidth}
          onChange={(e) => setContentWidth(parseInt(e.target.value))}
          className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
        />
        <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
          <span>28rem</span>
          <span>56rem</span>
        </div>
      </div>

      {/* Reset */}
      <div className="pt-1">
        <button
          onClick={resetTheme}
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
};

export default ReaderThemePanel;

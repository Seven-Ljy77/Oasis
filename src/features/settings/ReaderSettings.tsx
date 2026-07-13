import React from "react";
import { useReaderStore } from "@/stores/useReaderStore";
import type { ThemePreset, ThemeMode } from "@/lib/types";

const ReaderSettings: React.FC = () => {
  const themePreset = useReaderStore((s) => s.themePreset);
  const setThemePreset = useReaderStore((s) => s.setThemePreset);
  const themeMode = useReaderStore((s) => s.themeMode);
  const setThemeMode = useReaderStore((s) => s.setThemeMode);
  const quickStyle = useReaderStore((s) => s.quickStyle);
  const setQuickStyle = useReaderStore((s) => s.setQuickStyle);
  const fontFamily = useReaderStore((s) => s.fontFamily);
  const setFontFamily = useReaderStore((s) => s.setFontFamily);
  const fontSize = useReaderStore((s) => s.fontSize);
  const setFontSize = useReaderStore((s) => s.setFontSize);
  const lineHeight = useReaderStore((s) => s.lineHeight);
  const setLineHeight = useReaderStore((s) => s.setLineHeight);
  const contentWidth = useReaderStore((s) => s.contentWidth);
  const setContentWidth = useReaderStore((s) => s.setContentWidth);
  const resetTheme = useReaderStore((s) => s.resetTheme);

  const fontFamilies = [
    { value: "system-ui", label: "System Default" },
    { value: "'Merriweather', Georgia, serif", label: "Merriweather" },
    { value: "'Inter', system-ui, sans-serif", label: "Inter" },
  ];

  const quickStyles: { value: "none" | "warm" | "cool" | "slate"; label: string }[] = [
    { value: "none", label: "None" },
    { value: "warm", label: "Warm" },
    { value: "cool", label: "Cool" },
    { value: "slate", label: "Slate" },
  ];

  return (
    <div className="space-y-6">
      {/* Theme preset */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Theme Preset
        </label>
        <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5 w-fit">
          {(["classic", "paper"] as ThemePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => setThemePreset(preset)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
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

      {/* Appearance */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Appearance
        </label>
        <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5 w-fit">
          {(["auto", "forceLight", "forceDark"] as ThemeMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setThemeMode(mode)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Quick Style
        </label>
        <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5 w-fit">
          {quickStyles.map((style) => (
            <button
              key={style.value}
              onClick={() => setQuickStyle(style.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Font Family
        </label>
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          className="w-56 h-8 px-2 text-sm rounded-md border border-border bg-surface focus:border-accent focus:outline-none"
        >
          {fontFamilies.map((ff) => (
            <option key={ff.value} value={ff.value}>
              {ff.label}
            </option>
          ))}
        </select>
      </div>

      {/* Font size */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Font Size: {fontSize}px
        </label>
        <input
          type="range"
          min="12"
          max="28"
          step="1"
          value={fontSize}
          onChange={(e) => setFontSize(parseInt(e.target.value))}
          className="w-64 h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
        />
      </div>

      {/* Line height */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Line Height: {lineHeight.toFixed(1)}
        </label>
        <input
          type="range"
          min="1.2"
          max="2.5"
          step="0.05"
          value={lineHeight}
          onChange={(e) => setLineHeight(parseFloat(e.target.value))}
          className="w-64 h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
        />
      </div>

      {/* Content width */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Content Width: {contentWidth}rem
        </label>
        <input
          type="range"
          min="28"
          max="56"
          step="1"
          value={contentWidth}
          onChange={(e) => setContentWidth(parseInt(e.target.value))}
          className="w-64 h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
        />
      </div>

      {/* Live preview */}
      <div className="pt-2 border-t border-border">
        <h4 className="text-sm font-medium text-slate-700 mb-2">Preview</h4>
        <div
          className="p-4 rounded-lg border border-border bg-reader-bg"
          style={{
            fontFamily,
            fontSize: `${fontSize}px`,
            lineHeight,
            maxWidth: `${contentWidth}rem`,
          }}
        >
          <h2 className="text-xl font-bold mb-2" style={{ fontFamily }}>
            The quick brown fox
          </h2>
          <p className="text-reader-text-primary">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris.
          </p>
          <blockquote
            className="border-l-4 border-reader-blockquote-border pl-4 text-reader-text-secondary"
          >
            A reader lives a thousand lives before he dies. The man who never
            reads lives only one. &mdash; George R.R. Martin
          </blockquote>
        </div>
      </div>

      {/* Reset */}
      <div>
        <button
          onClick={resetTheme}
          className="text-sm text-accent hover:text-accent-hover transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
};

export default ReaderSettings;

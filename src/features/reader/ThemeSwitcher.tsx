import React, { useEffect, useRef, useState } from "react";
import { useReaderStore } from "@/stores/useReaderStore";
import { useI18n } from "@/lib/i18n";
import type { ThemePreset, ThemeMode } from "@/lib/types";

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const SunIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const MoonIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const EyeIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
  </svg>
);

const PaletteIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
  </svg>
);

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

interface ModeOption { value: ThemeMode; label: string; icon: React.FC<{ className?: string }> }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ThemeSwitcher: React.FC = () => {
  const { t } = useI18n();
  const themeMode = useReaderStore((s) => s.themeMode);
  const setThemeMode = useReaderStore((s) => s.setThemeMode);
  const themePreset = useReaderStore((s) => s.themePreset);
  const setThemePreset = useReaderStore((s) => s.setThemePreset);
  const fontSize = useReaderStore((s) => s.fontSize);
  const setFontSize = useReaderStore((s) => s.setFontSize);
  const fontFamily = useReaderStore((s) => s.fontFamily);
  const setFontFamily = useReaderStore((s) => s.setFontFamily);
  const lineHeight = useReaderStore((s) => s.lineHeight);
  const setLineHeight = useReaderStore((s) => s.setLineHeight);
  const contentWidth = useReaderStore((s) => s.contentWidth);
  const setContentWidth = useReaderStore((s) => s.setContentWidth);

  const MODE_OPTIONS: ModeOption[] = [
    { value: "auto", label: t.theme.auto, icon: PaletteIcon },
    { value: "forceLight", label: t.theme.light, icon: SunIcon },
    { value: "forceDark", label: t.theme.dark, icon: MoonIcon },
    { value: "eyecare", label: t.theme.eyeCare, icon: EyeIcon },
  ];

  const PRESET_OPTIONS: { value: ThemePreset; label: string; desc: string }[] = [
    { value: "classic", label: t.theme.classic, desc: "" },
    { value: "paper", label: t.theme.paper, desc: "" },
  ];

  const FONT_FAMILIES = [
    { value: "Georgia, serif", label: "Georgia" },
    { value: "'Merriweather', Georgia, serif", label: "Merriweather" },
    { value: "'Inter', system-ui, sans-serif", label: "Inter" },
    { value: "'JetBrains Mono', monospace", label: "JetBrains Mono" },
  ];

  const [open, setOpen] = useState(false);
  const [editFontSize, setEditFontSize] = useState(false);
  const [editLineHeight, setEditLineHeight] = useState(false);
  const [editContentWidth, setEditContentWidth] = useState(false);
  const [tempFontSize, setTempFontSize] = useState("");
  const [tempLineHeight, setTempLineHeight] = useState("");
  const [tempContentWidth, setTempContentWidth] = useState("");

  // Outside click to close
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const isActive = themeMode !== "auto" || themePreset !== "classic";
  const labelClass = "text-xs font-medium text-slate-500";
  const mutedClass = "text-[10px] text-slate-400";

  return (
    <div ref={containerRef} className="relative inline-flex">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`p-1.5 rounded transition-colors ${
          open
            ? "bg-accent-muted text-accent"
            : "text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary"
        }`}
        title={t.theme.readerTheme}
      >
        <PaletteIcon />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-[90] w-64 bg-surface border border-border rounded-lg shadow-lg p-3.5 space-y-3.5">
          {/* Appearance */}
          <div>
            <label className={labelClass}>{t.theme.appearance}</label>
            <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5 mt-1.5">
              {MODE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setThemeMode(value)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    themeMode === value
                      ? "bg-surface text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>
            <p className={`${mutedClass} mt-1`}>
              {themeMode === "auto" ? "Follow system" :
                themeMode === "eyecare" ? "Warm amber, gentle on the eyes" :
                themeMode === "forceDark" ? "Dark — easy on the eyes" :
                "Light — crisp & clear"}
            </p>
          </div>

          {/* Reader Theme */}
          <div>
            <label className={labelClass}>{t.theme.readerTheme}</label>
            <div className="space-y-1 mt-1.5">
              {PRESET_OPTIONS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setThemePreset(value)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-colors ${
                    themePreset === value
                      ? "bg-accent-muted"
                      : "hover:bg-surface-tertiary"
                  }`}
                >
                  <div className={`w-7 h-7 rounded flex-shrink-0 border border-border/50 flex items-center justify-center text-[10px] font-bold ${
                    value === "classic" ? "bg-[#faf9f7] text-[#1a1a1a]" : "bg-[#fdfaf3] text-[#2c2416]"
                  }`}>
                    Aa
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700">{label}</div>
                    <div className="text-[11px] text-slate-400">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label className={labelClass}>{t.theme.fontSize}</label>
            <div className="flex items-center justify-between bg-surface-tertiary rounded-lg px-2 py-1.5 mt-1.5">
              <button
                onClick={() => setFontSize(Math.max(12, fontSize - 1))}
                disabled={fontSize <= 12}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-surface hover:text-slate-700 transition-colors disabled:opacity-25"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M20 12H4" /></svg>
              </button>
              {editFontSize ? (
                <input
                  type="number"
                  value={tempFontSize}
                  onChange={(e) => setTempFontSize(e.target.value)}
                  onBlur={() => {
                    const v = parseInt(tempFontSize);
                    if (v >= 12 && v <= 28) setFontSize(v);
                    setEditFontSize(false);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="w-14 h-6 text-center text-sm border rounded"
                  autoFocus
                  min={12} max={28}
                />
              ) : (
                <span
                  className="text-sm font-medium text-slate-700 min-w-[3ch] text-center tabular-nums cursor-pointer hover:text-accent"
                  onClick={() => { setTempFontSize(String(fontSize)); setEditFontSize(true); }}
                  title="Click to edit"
                >{fontSize}</span>
              )}
              <span className="text-[10px] text-slate-400">px</span>
              <button
                onClick={() => setFontSize(Math.min(28, fontSize + 1))}
                disabled={fontSize >= 28}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-surface hover:text-slate-700 transition-colors disabled:opacity-25"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>

          {/* Font Family */}
          <div>
            <label className={labelClass}>{t.theme.fontFamily}</label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full h-8 px-2 mt-1.5 text-xs rounded-md border border-border bg-surface focus:border-accent focus:outline-none text-slate-700"
            >
              {FONT_FAMILIES.map((ff) => (
                <option key={ff.value} value={ff.value}>{ff.label}</option>
              ))}
            </select>
          </div>

          {/* Line Height */}
          <div>
            <label className={labelClass}>{t.theme.lineHeight}: {lineHeight.toFixed(1)}</label>
            <div className="flex items-center justify-between bg-surface-tertiary rounded-lg px-2 py-1.5 mt-1.5">
              <button
                onClick={() => setLineHeight(Math.max(1.2, lineHeight - 0.1))}
                disabled={lineHeight <= 1.2}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-surface hover:text-slate-700 transition-colors disabled:opacity-25"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M20 12H4" /></svg>
              </button>
              {editLineHeight ? (
                <input
                  type="number"
                  step="0.1"
                  value={tempLineHeight}
                  onChange={(e) => setTempLineHeight(e.target.value)}
                  onBlur={() => {
                    const v = parseFloat(tempLineHeight);
                    if (v >= 1.2 && v <= 3.0) setLineHeight(v);
                    setEditLineHeight(false);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="w-14 h-6 text-center text-sm border rounded"
                  autoFocus
                  min={1.2} max={3.0}
                />
              ) : (
                <span
                  className="text-sm font-medium text-slate-700 tabular-nums cursor-pointer hover:text-accent"
                  onClick={() => { setTempLineHeight(lineHeight.toFixed(1)); setEditLineHeight(true); }}
                  title="Click to edit"
                >{lineHeight.toFixed(1)}</span>
              )}
              <button
                onClick={() => setLineHeight(Math.min(3.0, lineHeight + 0.1))}
                disabled={lineHeight >= 3.0}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-surface hover:text-slate-700 transition-colors disabled:opacity-25"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>

          {/* Content Width */}
          <div>
            <label className={labelClass}>{t.theme.contentWidth}: {contentWidth}px</label>
            <div className="flex items-center justify-between bg-surface-tertiary rounded-lg px-2 py-1.5 mt-1.5">
              <button
                onClick={() => setContentWidth(Math.max(400, contentWidth - 40))}
                disabled={contentWidth <= 400}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-surface hover:text-slate-700 transition-colors disabled:opacity-25"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M20 12H4" /></svg>
              </button>
              {editContentWidth ? (
                <input
                  type="number"
                  step="40"
                  value={tempContentWidth}
                  onChange={(e) => setTempContentWidth(e.target.value)}
                  onBlur={() => {
                    const v = parseInt(tempContentWidth);
                    if (v >= 400 && v <= 1200) setContentWidth(v);
                    setEditContentWidth(false);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="w-14 h-6 text-center text-sm border rounded"
                  autoFocus
                  min={400} max={1200}
                />
              ) : (
                <span
                  className="text-sm font-medium text-slate-700 tabular-nums cursor-pointer hover:text-accent"
                  onClick={() => { setTempContentWidth(String(contentWidth)); setEditContentWidth(true); }}
                  title="Click to edit"
                >{contentWidth}</span>
              )}
              <button
                onClick={() => setContentWidth(Math.min(1200, contentWidth + 40))}
                disabled={contentWidth >= 1200}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:bg-surface hover:text-slate-700 transition-colors disabled:opacity-25"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSwitcher;

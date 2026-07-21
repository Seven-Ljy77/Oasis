// =============================================================================
// Mercury — GeneralSettings (general app settings)
// =============================================================================

import React, { useEffect } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useAppStore } from "@/stores/useAppStore";

export interface GeneralSettingsProps {
  className?: string;
}

const languages = [
  { value: "en", label: "English" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
];

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ className = "" }) => {
  const openSheet = useAppStore((s) => s.openSheet);
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const saveSettingsFn = useSettingsStore((s) => s.saveSettings);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const save = () => {
    const s = useSettingsStore.getState().settings;
    saveSettingsFn(s);
  };

  const language = settings.language ?? "en";
  const syncConcurrency = settings.sync_concurrency ?? 4;
  const usageRetentionMonths = settings.usage_retention_months ?? null;
  const aiTaggingEnabled = settings.ai_tagging_enabled ?? false;

  return (
    <div
      data-component="GeneralSettings"
      className={`p-4 space-y-5 ${className}`}
    >
      {/* Language selector */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Language
        </label>
        <select
          value={language}
          onChange={(e) => { updateSetting("language", e.target.value); save(); }}
          className="w-full h-8 px-2 text-sm rounded-md border border-border bg-surface focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
        >
          {languages.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-400">
          UI display language and AI output language preference.
        </p>
      </div>

      {/* Sync concurrency */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Sync Concurrency: {syncConcurrency}
        </label>
        <input
          type="range"
          min="1"
          max="16"
          step="1"
          value={syncConcurrency}
          onChange={(e) => { updateSetting("sync_concurrency", parseInt(e.target.value)); save(); }}
          className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
        />
        <div className="flex justify-between text-[11px] text-slate-400 mt-0.5">
          <span>1</span>
          <span>16</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Number of feeds to sync simultaneously.
        </p>
      </div>

      {/* Usage retention */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Usage Data Retention
        </label>
        <div className="flex items-center gap-2">
          <select
            value={usageRetentionMonths === null ? "forever" : String(usageRetentionMonths)}
            onChange={(e) => {
              const val = e.target.value;
              const v = val === "forever" ? null : parseInt(val);
              updateSetting("usage_retention_months", v);
              save();
            }}
            className="h-8 px-2 text-sm rounded-md border border-border bg-surface focus:border-accent focus:outline-none"
          >
            <option value="1">1 month</option>
            <option value="3">3 months</option>
            <option value="6">6 months</option>
            <option value="12">12 months</option>
            <option value="24">24 months</option>
            <option value="forever">Keep forever</option>
          </select>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          How long to keep API usage and analytics data.
        </p>
      </div>

      {/* AI tagging toggle */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={aiTaggingEnabled}
            onChange={(e) => { updateSetting("ai_tagging_enabled", e.target.checked); save(); }}
            className="rounded border-slate-300 text-accent w-4 h-4"
          />
          <span className="text-sm font-medium text-slate-700">
            Enable AI Auto-Tagging
          </span>
        </label>
        <p className="mt-1 ml-7 text-[11px] text-slate-400">
          Automatically suggest tags for new articles using AI.
        </p>
      </div>

      {/* Tag Library & Batch Tagging buttons */}
      <div className="pt-2 border-t border-border space-y-2">
        <button
          className="w-full py-2 px-3 text-sm font-medium rounded-md border border-border bg-surface hover:bg-surface-secondary transition-colors text-slate-700 text-left flex items-center gap-2"
          onClick={() => openSheet("tagLibrary")}
        >
          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Open Tag Library
        </button>

        <button
          className="w-full py-2 px-3 text-sm font-medium rounded-md border border-border bg-surface hover:bg-surface-secondary transition-colors text-slate-700 text-left flex items-center gap-2"
          onClick={() => openSheet("batchTagging")}
        >
          <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Batch AI Tagging
        </button>
      </div>
    </div>
  );
};

export default GeneralSettings;

// =============================================================================
// Mercury — GeneralSettings (general app settings)
// =============================================================================

import React from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useAppStore } from "@/stores/useAppStore";
import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/translations";

export interface GeneralSettingsProps {
  className?: string;
}

const languageOptions: { value: Locale; labelKey: string }[] = [
  { value: "en", labelKey: "English" },
  { value: "zh-CN", labelKey: "Chinese (Simplified)" },
];

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ className = "" }) => {
  const { t, locale, setLocale } = useI18n();
  const openSheet = useAppStore((s) => s.openSheet);
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const saveSettingsFn = useSettingsStore((s) => s.saveSettings);

  const save = () => {
    const s = useSettingsStore.getState().settings;
    saveSettingsFn(s);
  };

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
          {t.generalSettings.language}
        </label>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="w-full h-8 px-2 text-sm rounded-md border border-border bg-surface focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
        >
          {languageOptions.map((l) => (
            <option key={l.value} value={l.value}>
              {l.labelKey}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-400">
          {t.generalSettings.languageDesc}
        </p>
      </div>

      {/* Sync concurrency */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {t.generalSettings.syncConcurrency}: {syncConcurrency}
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
          {t.generalSettings.syncConcurrencyDesc}
        </p>
      </div>

      {/* Usage retention */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {t.generalSettings.usageRetention}
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
            <option value="1">1 {t.generalSettings.retentionMonths}</option>
            <option value="3">3 {t.generalSettings.retentionMonths}</option>
            <option value="6">6 {t.generalSettings.retentionMonths}</option>
            <option value="12">12 {t.generalSettings.retentionMonths}</option>
            <option value="24">24 {t.generalSettings.retentionMonths}</option>
            <option value="forever">{t.generalSettings.retentionKeepForever}</option>
          </select>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          {t.generalSettings.usageRetentionDesc}
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
            {t.generalSettings.aiTagging}
          </span>
        </label>
        <p className="mt-1 ml-7 text-[11px] text-slate-400">
          {t.generalSettings.aiTaggingDesc}
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
          {t.generalSettings.openTagLibrary}
        </button>

      </div>
    </div>
  );
};

export default GeneralSettings;

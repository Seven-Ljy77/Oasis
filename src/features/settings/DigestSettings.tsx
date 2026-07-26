// =============================================================================
// Mercury — DigestSettings (digest export settings)
// =============================================================================

import React from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useI18n } from "@/lib/i18n";
import { revealCustomTemplate } from "@/lib/ipc";
import { Button } from "@/components/ui/Button";
import { open } from "@tauri-apps/plugin-dialog";

export interface DigestSettingsProps {
  className?: string;
}

const DigestSettings: React.FC<DigestSettingsProps> = ({ className = "" }) => {
  const { t } = useI18n();
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const saveSettingsFn = useSettingsStore((s) => s.saveSettings);
  const save = () => saveSettingsFn(useSettingsStore.getState().settings);

  const exportFolder = settings.digest_export_folder ?? "";
  const templateName = settings.digest_template ?? "default";
  const templates = [
    { value: "default", label: "Default" },
    { value: "minimal", label: "Minimal" },
    { value: "academic", label: "Academic" },
    { value: "newsletter", label: "Newsletter Style" },
  ];

  return (
    <div
      data-component="DigestSettings"
      className={`p-4 space-y-5 ${className}`}
    >
      {/* Export folder path */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {t.digestSettings.exportFolder}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={exportFolder}
            onChange={(e) => {
              updateSetting("digest_export_folder", e.target.value);
              save();
            }}
            placeholder={t.digestSettings.noFolder}
            className="flex-1 h-8 px-2 text-sm rounded-md border border-border bg-surface focus:border-accent focus:outline-none truncate"
          />
          <button
            onClick={async () => {
              const selected = await open({ directory: true, multiple: false });
              if (selected) {
                updateSetting("digest_export_folder", selected as string);
                save();
              }
            }}
            className="px-3 py-1 text-xs font-medium rounded border border-border bg-surface hover:bg-surface-secondary text-slate-600 transition-colors whitespace-nowrap"
          >
            {t.digestSettings.browse}
          </button>
        </div>
      </div>

      {/* Template selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {t.digestSettings.template}
        </label>
        <select
          value={templateName}
          onChange={(e) => {
            updateSetting("digest_template", e.target.value);
            save();
          }}
          className="w-full h-8 px-2 text-sm rounded-md border border-border bg-surface focus:border-accent focus:outline-none"
        >
          {templates.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-400">
          {t.digestSettings.templateCustomization}
        </p>
      </div>

      {/* Template customization */}
      <div className="pt-3 border-t border-border">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          {t.digestSettings.templateCustomization}
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          {t.digestSettings.templateCustomization}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            // Map template name to template ID for revealing
            const id = templateName === "default" ? "single-markdown" : templateName;
            revealCustomTemplate(`${id}.yaml`);
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          {t.digestSettings.openTemplateFile}
        </Button>
      </div>
    </div>
  );
};

export default DigestSettings;

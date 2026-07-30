import React, { useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useI18n } from "@/lib/i18n";
import { exportMultipleDigest, exportArticles } from "@/lib/ipc";
import { save } from "@tauri-apps/plugin-dialog";
import Button from "@/components/ui/Button";

const MultiSelectToolbar: React.FC = () => {
  const { t } = useI18n();
  const selectedEntryIds = useAppStore((s) => s.selectedEntryIds);
  const exitMultiSelect = useAppStore((s) => s.exitMultiSelect);
  const [exporting, setExporting] = useState(false);

  const count = selectedEntryIds.size;
  const entryIds = Array.from(selectedEntryIds);

  const handleExportDigest = async () => {
    if (entryIds.length === 0) return;
    (window as any).__mercury_flush_note?.();
    setExporting(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const exportFolder = useSettingsStore.getState().settings.digest_export_folder;
      const filename = `digest-${date}.md`;
      const defaultPath = exportFolder
        ? `${exportFolder.replace(/[/\\]$/, "")}/${filename}`
        : filename;
      const filePath = await save({
        defaultPath,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (filePath) {
        await exportMultipleDigest(entryIds, filePath);
        exitMultiSelect();
      }
    } catch (e) {
      console.error("Export digest failed:", e);
    } finally {
      setExporting(false);
    }
  };

  const handleExportArticles = async () => {
    if (entryIds.length === 0) return;
    setExporting(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const exportFolder = useSettingsStore.getState().settings.digest_export_folder;
      const filename = `articles-${date}.md`;
      const defaultPath = exportFolder
        ? `${exportFolder.replace(/[/\\]$/, "")}/${filename}`
        : filename;
      const filePath = await save({
        defaultPath,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (filePath) {
        await exportArticles(entryIds, filePath);
        exitMultiSelect();
      }
    } catch (e) {
      console.error("Export articles failed:", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-accent-muted border-b border-accent/20">
      <span className="text-sm font-medium text-accent">
        {count} {t.entryList.selected}
      </span>

      <div className="flex-1" />

      <Button variant="ghost" size="sm" onClick={exitMultiSelect}>
        {t.common.cancel}
      </Button>

      <Button
        variant="primary"
        size="sm"
        onClick={handleExportDigest}
        disabled={exporting || count === 0}
      >
        {t.entryList.exportDigest}
      </Button>

      <Button
        variant="primary"
        size="sm"
        onClick={handleExportArticles}
        disabled={exporting || count === 0}
      >
        {t.entryList.exportArticles}
      </Button>
    </div>
  );
};

export default MultiSelectToolbar;

import React, { useState } from "react";
import { useEntryStore } from "@/stores/useEntryStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useI18n } from "@/lib/i18n";
import { exportMultipleDigest } from "@/lib/ipc";
import { flushPendingNoteDraft } from "@/lib/noteDraft";
import { save } from "@tauri-apps/plugin-dialog";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

interface ExportMultipleDigestSheetProps {
  open: boolean;
  onClose: () => void;
}

const ExportMultipleDigestSheet: React.FC<ExportMultipleDigestSheetProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const entries = useEntryStore((s) => s.entries);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.id)));
    }
  };

  const entryIds = Array.from(selected);

  const handleExport = async () => {
    if (entryIds.length === 0) return;
    setExporting(true);
    setError(null);
    try {
      await flushPendingNoteDraft(entryIds);
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
        onClose();
      }
    } catch (e) {
      console.error("Export failed:", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t.digest.exportMultipleTitle} width="550px">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            {entryIds.length} {t.entryList.selected}
          </p>
          <button onClick={selectAll} className="text-xs text-accent hover:underline">
            {selected.size === entries.length ? t.digest.deselectAll : t.digest.selectAll}
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto border border-border rounded">
          {entries.map((e) => (
            <label
              key={e.id}
              className={`flex items-center gap-3 px-3 py-2 border-b border-border/50 text-sm cursor-pointer hover:bg-surface-tertiary ${
                selected.has(e.id) ? "bg-accent-muted" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(e.id)}
                onChange={() => toggle(e.id)}
                className="rounded w-3.5 h-3.5"
              />
              <span className="truncate">{e.title ?? "Untitled"}</span>
            </label>
          ))}
          {entries.length === 0 && (
            <p className="px-3 py-4 text-sm text-slate-400 text-center">{t.entryList.noArticles}</p>
          )}
        </div>

        {error && <p className="text-xs text-red-500 break-words">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={handleExport} disabled={exporting || entryIds.length === 0}>
            {exporting ? t.common.loading : t.digest.exportNArticles.replace("{n}", String(entryIds.length))}
          </Button>
        </div>
      </div>
    </Sheet>
  );
};

export default ExportMultipleDigestSheet;

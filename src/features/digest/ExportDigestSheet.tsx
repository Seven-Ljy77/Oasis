import React, { useState, useEffect } from "react";
import { useEntryStore } from "@/stores/useEntryStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useI18n } from "@/lib/i18n";
import { exportDigest } from "@/lib/ipc";
import { save } from "@tauri-apps/plugin-dialog";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

interface ExportDigestSheetProps {
  open: boolean;
  onClose: () => void;
}

const ExportDigestSheet: React.FC<ExportDigestSheetProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const selectedEntryId = useEntryStore((s) => s.selectedEntryId);
  const entry = useEntryStore((s) => s.entries.find((e) => e.id === selectedEntryId));
  const [exporting, setExporting] = useState(false);

  const title = entry?.title ?? "Untitled";
  const author = entry?.author ?? "";
  const url = entry?.url ?? "";

  const genFilename = () => {
    const date = new Date().toISOString().slice(0, 10);
    const slug = title
      .replace(/[^\w一-鿿\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80);
    return `${date}-${slug}.md`;
  };

  const handleExport = async () => {
    if (!selectedEntryId) return;
    (window as any).__mercury_flush_note?.();
    setExporting(true);
    try {
      const exportFolder = useSettingsStore.getState().settings.digest_export_folder;
      const defaultPath = exportFolder
        ? `${exportFolder.replace(/[/\\]$/, "")}/${genFilename()}`
        : genFilename();
      const filePath = await save({
        defaultPath,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (filePath) {
        await exportDigest(selectedEntryId, filePath);
        onClose();
      }
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t.digest.exportTitle} width="500px">
      <div className="space-y-4">
        <div className="text-sm text-slate-600">
          <p><strong>Title:</strong> {title}</p>
          {author && <p><strong>Author:</strong> {author}</p>}
          {url && <p className="truncate"><strong>URL:</strong> {url}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={handleExport} disabled={exporting}>
            {exporting ? t.common.loading : t.digest.exportMarkdown}
          </Button>
        </div>
      </div>
    </Sheet>
  );
};

export default ExportDigestSheet;

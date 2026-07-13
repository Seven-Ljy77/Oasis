import React, { useState } from "react";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import { useFeedStore } from "@/stores/useFeedStore";
import * as dialog from "@tauri-apps/plugin-dialog";

interface ImportOPMLSheetProps {
  open: boolean;
  onClose: () => void;
}

const ImportOPMLSheet: React.FC<ImportOPMLSheetProps> = ({ open, onClose }) => {
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [forceSiteName, setForceSiteName] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importOpml = useFeedStore((s) => s.importOpml);
  const loadFeeds = useFeedStore((s) => s.loadFeeds);

  const handlePickFile = async () => {
    const selected = await dialog.open({
      filters: [{ name: "OPML Files", extensions: ["opml", "xml"] }],
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      setSelectedPath(selected);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!selectedPath) return;
    setImporting(true);
    setError(null);
    try {
      await importOpml(selectedPath, replaceExisting, forceSiteName);
      await loadFeeds();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Import OPML">
      <div className="space-y-5">
        {/* File picker */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            OPML File
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={selectedPath ?? ""}
              placeholder="Choose an .opml file..."
              className="flex-1 h-8 px-3 text-sm rounded-md border border-border bg-surface-secondary text-slate-500"
            />
            <Button variant="secondary" size="sm" onClick={handlePickFile}>
              Browse...
            </Button>
          </div>
        </div>

        {/* Replace existing toggle */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-accent focus:ring-accent"
          />
          <div>
            <span className="text-sm font-medium text-slate-700">
              Replace existing feeds
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              All current feeds will be removed before importing. Existing entries and
              their metadata will be preserved.
            </p>
          </div>
        </label>

        {/* Force site name toggle */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={forceSiteName}
            onChange={(e) => setForceSiteName(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-accent focus:ring-accent"
          />
          <div>
            <span className="text-sm font-medium text-slate-700">
              Force site name as feed title
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Uses the site domain name as the feed title instead of the title specified
              in the OPML file. Useful for feeds with duplicate or unclear names.
            </p>
          </div>
        </label>

        {/* Error message */}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleImport}
            loading={importing}
            disabled={!selectedPath}
          >
            Import
          </Button>
        </div>
      </div>
    </Sheet>
  );
};

export default ImportOPMLSheet;

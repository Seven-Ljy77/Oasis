import React, { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import { useFeedStore } from "@/stores/useFeedStore";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import * as dialog from "@tauri-apps/plugin-dialog";
import type { ImportProgressEvent } from "@/lib/types";

interface ImportOPMLSheetProps {
  open: boolean;
  onClose: () => void;
}

interface FeedProgress {
  title: string;
  url: string;
  status: "fetching" | "done" | "error" | "skipped";
  error?: string;
}

const ImportOPMLSheet: React.FC<ImportOPMLSheetProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [forceSiteName, setForceSiteName] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Progress tracking
  const [feedProgress, setFeedProgress] = useState<FeedProgress[]>([]);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);

  // Import result (shown after completion)
  const [result, setResult] = useState<{
    added: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const importOpml = useFeedStore((s) => s.importOpml);
  const loadFeeds = useFeedStore((s) => s.loadFeeds);

  // Listen for progress events during import
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<ImportProgressEvent>(
        "import-opml-progress",
        (event) => {
          const { feed_title, feed_url, status, completed: c, total: t, error: errMsg } =
            event.payload;
          setFeedProgress((prev) => {
            // Update or add entry for this feed
            const existing = prev.findIndex((p) => p.url === feed_url);
            const entry: FeedProgress = {
              title: feed_title,
              url: feed_url,
              status,
              error: errMsg,
            };
            if (existing >= 0) {
              const next = [...prev];
              next[existing] = entry;
              return next;
            }
            return [...prev, entry];
          });
          setCompleted(c);
          setTotal(t);
        },
      );
    };

    if (importing) {
      setupListener();
    }

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [importing]);

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setFeedProgress([]);
      setCompleted(0);
      setTotal(0);
      setResult(null);
      setError(null);
    }
  }, [open]);

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
    setResult(null);
    try {
      const res = await importOpml(selectedPath, replaceExisting, forceSiteName, 6);
      await loadFeeds();
      setResult(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      onClose();
    }
  };

  // Count per-status feeds
  const statusCounts = {
    fetching: feedProgress.filter((p) => p.status === "fetching").length,
    done: feedProgress.filter((p) => p.status === "done").length,
    error: feedProgress.filter((p) => p.status === "error").length,
    skipped: feedProgress.filter((p) => p.status === "skipped").length,
  };

  return (
    <Sheet open={open} onClose={handleClose} title={t.opmlImport.title}>
      <div className="space-y-5">
        {/* File picker */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t.opmlImport.opmlFile}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={selectedPath ?? ""}
              placeholder="Choose an .opml file..."
              className="flex-1 h-8 px-3 text-sm rounded-md border border-border bg-surface-secondary text-slate-500"
            />
            <Button variant="secondary" size="sm" onClick={handlePickFile} disabled={importing}>
              {t.opmlImport.browse}
            </Button>
          </div>
        </div>

        {/* Replace existing toggle */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
            disabled={importing}
            className="mt-0.5 rounded border-slate-300 text-accent focus:ring-accent"
          />
          <div>
            <span className="text-sm font-medium text-slate-700">
              {t.opmlImport.replaceExisting}
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.opmlImport.replaceExistingDesc}
            </p>
          </div>
        </label>

        {/* Force site name toggle */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={forceSiteName}
            onChange={(e) => setForceSiteName(e.target.checked)}
            disabled={importing}
            className="mt-0.5 rounded border-slate-300 text-accent focus:ring-accent"
          />
          <div>
            <span className="text-sm font-medium text-slate-700">
              {t.opmlImport.forceSiteName}
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.opmlImport.forceSiteNameDesc}
            </p>
          </div>
        </label>

        {/* Progress display */}
        {importing && (
          <div className="rounded-md border border-border bg-surface-secondary p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">
                {t.opmlImport.importing}
              </span>
              <span className="text-xs text-slate-500">
                {completed}/{total > 0 ? total : "?"} {t.opmlImport.completed}
              </span>
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <div className="w-full h-1.5 bg-slate-200 rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${(completed / total) * 100}%` }}
                />
              </div>
            )}

            {/* Status summary chips */}
            <div className="flex gap-3 mb-2 text-xs">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                {statusCounts.fetching} {t.opmlImport.fetching}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {statusCounts.done} {t.opmlImport.done}
              </span>
              {statusCounts.skipped > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  {statusCounts.skipped} {t.opmlImport.skipped}
                </span>
              )}
              {statusCounts.error > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  {statusCounts.error} {t.opmlImport.error}
                </span>
              )}
            </div>

            {/* Current feed list (max 8 visible, scrollable) */}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {feedProgress.slice(-8).reverse().map((fp) => (
                <div
                  key={fp.url}
                  className="flex items-center gap-2 text-xs py-0.5"
                >
                  {/* Status icon */}
                  {fp.status === "fetching" && (
                    <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />
                  )}
                  {fp.status === "done" && (
                    <span className="text-emerald-500 shrink-0">&#10003;</span>
                  )}
                  {fp.status === "error" && (
                    <span className="text-red-500 shrink-0">&#10007;</span>
                  )}
                  {fp.status === "skipped" && (
                    <span className="text-amber-500 shrink-0">&#8594;</span>
                  )}

                  <span className="truncate text-slate-600">{fp.title}</span>

                  {fp.error && (
                    <span className="text-red-400 truncate ml-auto" title={fp.error}>
                      {fp.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completion summary */}
        {result && !importing && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-3 text-sm">
            <p className="font-medium text-emerald-800 mb-1">{t.digest.importComplete}</p>
            <div className="flex gap-4 text-emerald-700">
              <span>{result.added} {t.opmlImport.added}</span>
              {result.skipped > 0 && <span>{result.skipped} {t.opmlImport.skipped}</span>}
            </div>
            {result.errors.length > 0 && (
              <details className="mt-2">
                <summary className="text-red-600 cursor-pointer text-xs">
                  {result.errors.length} {result.errors.length !== 1 ? t.opmlImport.errors : t.opmlImport.error}
                </summary>
                <ul className="mt-1 space-y-0.5 text-xs text-red-500">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Error message */}
        {error && !importing && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            size="md"
            onClick={handleClose}
            disabled={importing}
          >
            {result ? t.opmlImport.close : t.common.cancel}
          </Button>
          {!result && (
            <Button
              variant="primary"
              size="md"
              onClick={handleImport}
              loading={importing}
              disabled={!selectedPath}
            >
              {t.opmlImport.import_}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
};

export default ImportOPMLSheet;

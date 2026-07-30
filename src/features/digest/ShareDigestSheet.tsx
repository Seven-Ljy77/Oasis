import React, { useCallback, useEffect, useRef, useState } from "react";
import { useEntryStore } from "@/stores/useEntryStore";
import { useI18n } from "@/lib/i18n";
import { shareDigest } from "@/lib/ipc";
import { flushPendingNoteDraft } from "@/lib/noteDraft";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

interface ShareDigestSheetProps {
  open: boolean;
  onClose: () => void;
}

const ShareDigestSheet: React.FC<ShareDigestSheetProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const selectedEntryId = useEntryStore((s) => s.selectedEntryId);
  const entry = useEntryStore((s) => s.entries.find((e) => e.id === selectedEntryId));
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  const title = entry?.title ?? "Untitled";
  const author = entry?.author ?? "";
  const [digestText, setDigestText] = useState("");

  const loadDigest = useCallback(async () => {
    if (!selectedEntryId) return;
    const entryId = selectedEntryId;
    const requestVersion = ++requestVersionRef.current;
    setCopied(false);
    setDigestText("");
    setError(null);
    setLoading(true);
    try {
      await flushPendingNoteDraft([entryId]);
      const digest = await shareDigest(entryId);
      if (requestVersion === requestVersionRef.current) {
        setDigestText(digest);
      }
    } catch (loadError) {
      if (requestVersion === requestVersionRef.current) {
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      }
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [selectedEntryId]);

  useEffect(() => {
    if (open) void loadDigest();
    return () => {
      requestVersionRef.current += 1;
    };
  }, [loadDigest, open]);

  const handleCopy = async () => {
    if (loading || error || !digestText) return;
    try {
      await navigator.clipboard.writeText(digestText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Share failed:", e);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t.digest.shareTitle} width="500px">
      <div className="space-y-4">
        <div className="text-sm text-slate-600">
          <p><strong>{title}</strong></p>
          {author && <p>{author}</p>}
        </div>
        <pre className="p-3 rounded border border-border bg-surface-secondary text-xs text-slate-600 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
          {loading
            ? t.common.loading
            : error
              ? t.digest.loadFailed
              : digestText}
        </pre>
        {error && (
          <p className="text-xs text-red-500 break-words">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          {error && (
            <Button variant="secondary" onClick={() => void loadDigest()}>
              {t.common.retry}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleCopy}
            disabled={loading || Boolean(error) || !digestText}
          >
            {copied ? t.digest.copied : t.digest.copyToClipboard}
          </Button>
        </div>
      </div>
    </Sheet>
  );
};

export default ShareDigestSheet;

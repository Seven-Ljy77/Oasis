import React, { useState, useEffect } from "react";
import { useEntryStore } from "@/stores/useEntryStore";
import { useReaderStore } from "@/stores/useReaderStore";
import { useI18n } from "@/lib/i18n";
import { shareDigest, getNote } from "@/lib/ipc";
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
  const summaryText = useReaderStore((s) => s.summaryText);
  const [copied, setCopied] = useState(false);

  const title = entry?.title ?? "Untitled";
  const author = entry?.author ?? "";
  const url = entry?.url ?? "";

  const [digestText, setDigestText] = useState("");

  useEffect(() => {
    if (!selectedEntryId || !open) return;
    shareDigest(selectedEntryId).then(setDigestText).catch(() => {});
  }, [selectedEntryId, open]);

  const handleCopy = async () => {
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
          {digestText || t.common.loading}
        </pre>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" onClick={handleCopy}>
            {copied ? t.digest.copied : t.digest.copyToClipboard}
          </Button>
        </div>
      </div>
    </Sheet>
  );
};

export default ShareDigestSheet;

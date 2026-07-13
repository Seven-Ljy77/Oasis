import React, { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

interface ShareDigestSheetProps {
  open: boolean;
  onClose: () => void;
  /** If provided, pre-fills article metadata */
  articleTitle?: string;
  articleAuthor?: string | null;
  articleUrl?: string;
}

const ShareDigestSheet: React.FC<ShareDigestSheetProps> = ({
  open,
  onClose,
  articleTitle = "Getting Started with Rust and Tauri",
  articleAuthor = "Jane Doe",
  articleUrl = "https://example.com/rust-tauri-guide",
}) => {
  const [includeNote, setIncludeNote] = useState(false);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [noteText, setNoteText] = useState("");

  // Build share preview
  const buildShareText = () => {
    let text = `**${articleTitle}**`;
    if (articleAuthor) text += `\nby ${articleAuthor}`;
    text += `\n${articleUrl}`;

    if (includeSummary) {
      text +=
        "\n\n---\nSummary: A comprehensive guide covering Rust and Tauri 2.0 for building cross-platform desktop applications. Covers setup, architecture patterns, and deployment.";
    }

    if (includeNote && noteText.trim()) {
      text += `\n\n---\nNotes: ${noteText}`;
    }

    return text;
  };

  const shareText = buildShareText();

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
  };

  const handleShare = () => {
    // TODO: use Tauri's share API or open system share sheet
    navigator.clipboard.writeText(shareText);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Share Digest" width="560px">
      <div className="space-y-4">
        {/* Article metadata */}
        <div className="p-3 bg-surface-secondary rounded-lg space-y-1">
          <div className="flex gap-2 text-sm">
            <span className="text-slate-500 w-14 flex-shrink-0">Title:</span>
            <span className="text-slate-700 font-medium truncate">
              {articleTitle}
            </span>
          </div>
          {articleAuthor && (
            <div className="flex gap-2 text-sm">
              <span className="text-slate-500 w-14 flex-shrink-0">Author:</span>
              <span className="text-slate-600">{articleAuthor}</span>
            </div>
          )}
          <div className="flex gap-2 text-sm">
            <span className="text-slate-500 w-14 flex-shrink-0">URL:</span>
            <span className="text-slate-500 text-xs truncate">{articleUrl}</span>
          </div>
        </div>

        {/* Include toggles */}
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSummary}
              onChange={(e) => setIncludeSummary(e.target.checked)}
              className="rounded border-slate-300 text-accent w-3.5 h-3.5"
            />
            <span className="text-sm text-slate-700">Include summary</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeNote}
              onChange={(e) => setIncludeNote(e.target.checked)}
              className="rounded border-slate-300 text-accent w-3.5 h-3.5"
            />
            <span className="text-sm text-slate-700">Include note</span>
          </label>

          {includeNote && (
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write a note to include in the share..."
              rows={3}
              className="w-full text-sm rounded-md border border-border bg-surface p-2 focus:border-accent focus:outline-none resize-none"
            />
          )}
        </div>

        {/* Live preview */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Preview
          </label>
          <div className="p-3 bg-surface-secondary rounded-lg border border-border text-sm text-slate-600 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono text-xs">
            {shareText}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" size="md" onClick={handleCopy}>
            Copy
          </Button>
          <Button variant="primary" size="md" onClick={handleShare}>
            Share
          </Button>
        </div>
      </div>
    </Sheet>
  );
};

export default ShareDigestSheet;

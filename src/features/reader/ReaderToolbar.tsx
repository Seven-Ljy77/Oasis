import React from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useReaderStore } from "@/stores/useReaderStore";
import ReadingModePicker from "./ReadingModePicker";
import type { ReaderPanel } from "@/lib/types";

interface ReaderToolbarProps {
  entryTitle: string;
  entryUrl: string;
  hasNote: boolean;
  onTogglePanel: (panel: ReaderPanel) => void;
  activePanel: ReaderPanel;
}

const ReaderToolbar: React.FC<ReaderToolbarProps> = ({
  entryTitle,
  entryUrl,
  hasNote,
  onTogglePanel,
  activePanel,
}) => {
  const readingMode = useAppStore((s) => s.readingMode);
  const setReadingMode = useAppStore((s) => s.setReadingMode);

  const translationEnabled = useReaderStore((s) => s.translationEnabled);
  const setTranslationEnabled = useReaderStore((s) => s.setTranslationEnabled);

  const handleShare = () => {
    // TODO: implement share menu (system share, copy link, open in browser)
    navigator.clipboard.writeText(entryUrl);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-secondary">
      {/* Reading mode picker */}
      <ReadingModePicker value={readingMode} onChange={setReadingMode} />

      {/* Flexible space */}
      <div className="flex-1" />

      {/* Translation toggle */}
      <button
        onClick={() => setTranslationEnabled(!translationEnabled)}
        className={`p-1.5 rounded transition-colors ${
          translationEnabled
            ? "bg-accent-muted text-accent"
            : "text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary"
        }`}
        title="Toggle translation"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
          />
        </svg>
      </button>

      {/* Clear translation */}
      <button
        className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary transition-colors"
        title="Clear translation"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {/* Tagging button */}
      <button
        onClick={() => onTogglePanel("translation")}
        className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary transition-colors"
        title="Tag this article"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      </button>

      {/* Note button */}
      <button
        onClick={() => onTogglePanel("note")}
        className={`p-1.5 rounded transition-colors relative ${
          activePanel === "note"
            ? "bg-accent-muted text-accent"
            : "text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary"
        }`}
        title="Add note"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        {hasNote && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-accent rounded-full" />
        )}
      </button>

      {/* Theme button */}
      <button
        className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary transition-colors"
        title="Reader theme"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      </button>

      {/* Share menu */}
      <button
        onClick={handleShare}
        className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary transition-colors"
        title="Share"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      </button>
    </div>
  );
};

export default ReaderToolbar;

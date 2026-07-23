import React, { useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useReaderStore } from "@/stores/useReaderStore";
import ReadingModePicker from "./ReadingModePicker";
import ThemeSwitcher from "./ThemeSwitcher";
import type { ReaderPanel } from "@/lib/types";

interface ReaderToolbarProps {
  // Reserved for future use (AI actions, share, tooltips)
  entryTitle: string;
  // Reserved for future use (AI agent requests, translation, etc.)
  entryId: number | null;
  entryUrl: string;
  isStarred: boolean;
  hasNote: boolean;
  onTogglePanel: (panel: ReaderPanel) => void;
  activePanel: ReaderPanel;
  onStar: () => void;
}

const ReaderToolbar: React.FC<ReaderToolbarProps> = ({
  entryTitle, // reserved for future use
  entryUrl,
  entryId, // reserved for future use
  isStarred,
  hasNote,
  onTogglePanel,
  activePanel,
  onStar,
}) => {
  const readingMode = useAppStore((s) => s.readingMode);
  const setReadingMode = useAppStore((s) => s.setReadingMode);

  const translationEnabled = useReaderStore((s) => s.translationEnabled);
  const setTranslationEnabled = useReaderStore((s) => s.setTranslationEnabled);

  const [shareOpen, setShareOpen] = useState(false);

  const handleShare = (action: "copy" | "browser") => {
    setShareOpen(false);
    if (action === "copy") {
      navigator.clipboard.writeText(entryUrl);
    } else {
      window.open(entryUrl, "_blank");
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-secondary">
      {/* Reading mode picker */}
      <ReadingModePicker value={readingMode} onChange={setReadingMode} />

      {/* Flexible space */}
      <div className="flex-1" />

      {/* Star button */}
      <button
        onClick={onStar}
        className={`p-1.5 rounded transition-colors ${
          isStarred
            ? "text-amber-400"
            : "text-slate-400 hover:text-amber-400 hover:bg-surface-tertiary"
        }`}
        title={isStarred ? "Unstar this article" : "Star this article"}
      >
        <svg className="w-4 h-4" fill={isStarred ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      </button>

      {/* Summary button */}
      <button
        onClick={() => onTogglePanel("summary")}
        className={`p-1.5 rounded transition-colors ${
          activePanel === "summary"
            ? "bg-accent-muted text-accent"
            : "text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary"
        }`}
        title="AI Summary"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </button>

      {/* Translation toggle */}
      <button
        onClick={() => {
          onTogglePanel("translation");
          setTranslationEnabled(!translationEnabled);
        }}
        className={`p-1.5 rounded transition-colors ${
          activePanel === "translation"
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
        onClick={() => {
          useReaderStore.setState({
            translationEnabled: false,
            translationHTML: null,
            translationSegments: [],
          });
        }}
        className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary transition-colors"
        title="Clear translation"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {/* Tagging button */}
      <button
        onClick={() => onTogglePanel("tagging")}
        className={`p-1.5 rounded transition-colors ${
          activePanel === "tagging"
            ? "bg-accent-muted text-accent"
            : "text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary"
        }`}
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
        title="Article Note"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {hasNote && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-accent rounded-full" />
        )}
      </button>

      {/* Theme switcher */}
      <ThemeSwitcher />

      {/* Share menu */}
      <div className="relative">
        <button
          onClick={() => setShareOpen(!shareOpen)}
          className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary transition-colors"
          title="Share"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
        {shareOpen && (
          <div className="absolute right-0 top-full mt-1 w-40 bg-surface border border-border rounded-lg shadow-lg py-1 z-50">
            <button
              onClick={() => handleShare("copy")}
              className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-surface-tertiary"
            >
              Copy Link
            </button>
            <button
              onClick={() => handleShare("browser")}
              className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-surface-tertiary"
            >
              Open in Browser
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReaderToolbar;

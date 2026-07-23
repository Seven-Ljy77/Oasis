import React, { useEffect } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useEntryStore } from "@/stores/useEntryStore";
import { useReaderStore } from "@/stores/useReaderStore";
import ReaderToolbar from "./ReaderToolbar";
import ReaderWebView from "./ReaderWebView";
import ReaderSummaryPanel from "./ReaderSummaryPanel";
import ReaderTranslationPanel from "./ReaderTranslationPanel";
import ReaderTaggingPanel from "./ReaderTaggingPanel";
import ReaderNotePanel from "./ReaderNotePanel";
import Button from "@/components/ui/Button";

const ReaderDetailView: React.FC = () => {
  const selectedEntryId = useEntryStore((s) => s.selectedEntryId);
  const readingMode = useAppStore((s) => s.readingMode);

  const entry = useEntryStore((s) =>
    s.entries.find((e) => e.id === selectedEntryId),
  );

  const readerHTML = useReaderStore((s) => s.readerHTML);
  const readerLoading = useReaderStore((s) => s.readerLoading);
  const translationHTML = useReaderStore((s) => s.translationHTML);
  const buildReaderHTML = useReaderStore((s) => s.buildReaderHTML);
  const activePanel = useReaderStore((s) => s.activePanel);
  const setActivePanel = useReaderStore((s) => s.setActivePanel);
  const bannerMessage = useReaderStore((s) => s.bannerMessage);
  const bannerType = useReaderStore((s) => s.bannerType);
  const bannerAction = useReaderStore((s) => s.bannerAction);
  const setBanner = useReaderStore((s) => s.setBanner);
  const markStarred = useEntryStore((s) => s.markStarred);

  // Subscribe to theme fields
  const fontFamily = useReaderStore((s) => s.fontFamily);
  const fontSize = useReaderStore((s) => s.fontSize);
  const lineHeight = useReaderStore((s) => s.lineHeight);
  const contentWidth = useReaderStore((s) => s.contentWidth);
  const quickStyle = useReaderStore((s) => s.quickStyle);

  // Build reader HTML when entry or theme changes
  useEffect(() => {
    useReaderStore.setState({ translationHTML: null });
    if (entry?.url) {
      buildReaderHTML(entry.url, true);
    }
  }, [selectedEntryId, fontFamily, fontSize, lineHeight, contentWidth, quickStyle]);

  const showPanel = (panel: typeof activePanel) => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  // ---- No article selected empty state ----
  if (!entry) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-slate-400">
        <svg
          className="w-16 h-16 mb-4 text-slate-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
          />
        </svg>
        <h3 className="text-base font-medium text-slate-500 mb-1">
          No article selected
        </h3>
        <p className="text-sm text-slate-400">
          Select an article from the list to start reading.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ---- Toolbar ---- */}
      <ReaderToolbar
        entryTitle={entry.title ?? "Untitled"}
        entryUrl={entry.url ?? ""}
        entryId={entry.id}
        isStarred={entry.is_starred}
        hasNote={false} // TODO: check if note exists for this entry
        onTogglePanel={showPanel}
        activePanel={activePanel}
        onStar={() => markStarred(entry.id, !entry.is_starred)}
      />

      {/* ---- Banner area ---- */}
      {bannerMessage && (
        <div
          className={`px-4 py-2 text-sm flex items-center gap-3 ${
            bannerType === "error"
              ? "bg-red-50 text-red-700 border-b border-red-200"
              : bannerType === "warning"
                ? "bg-amber-50 text-amber-700 border-b border-amber-200"
                : "bg-blue-50 text-blue-700 border-b border-blue-200"
          }`}
        >
          <span className="flex-1">{bannerMessage}</span>
          {bannerAction && (
            <button
              onClick={bannerAction.onClick}
              className="font-medium underline hover:no-underline"
            >
              {bannerAction.label}
            </button>
          )}
          <button
            onClick={() => setBanner(null)}
            className="text-current opacity-50 hover:opacity-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ---- URL bar ---- */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary border-b border-border text-xs text-slate-400">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span className="truncate">{entry.url ?? "about:blank"}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(entry.url ?? "");
          }}
          className="p-0.5 rounded hover:bg-surface-tertiary hover:text-slate-600 transition-colors"
          title="Copy link"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {/* ---- Reader content ---- */}
      <div className="flex-1 overflow-hidden">
        {readingMode === "dual" ? (
          <div className="flex h-full">
            <div className="flex-1 border-r border-border">
              <ReaderWebView html={translationHTML ? translationHTML : (readerHTML ?? "")} baseURL={entry.url ?? "about:blank"} mode="reader" loading={readerLoading} />
            </div>
            <div className="flex-1">
              <ReaderWebView html={readerHTML ?? ""} baseURL={entry.url ?? "about:blank"} mode="web" loading={readerLoading} />
            </div>
          </div>
        ) : (
          <ReaderWebView
            html={readingMode === "web" ? "" : translationHTML ? translationHTML : (readerHTML ?? "")}
            baseURL={entry.url ?? "about:blank"}
            mode={readingMode === "web" ? "web" : "reader"}
            loading={readerLoading}
          />
        )}
      </div>

      {/* ---- Bottom panels ---- */}
      {activePanel === "summary" && <ReaderSummaryPanel />}
      {activePanel === "translation" && <ReaderTranslationPanel />}

      {/* ---- Popover panels (rendered as overlays from toolbar buttons) ---- */}
      <ReaderTaggingPanel />
      {activePanel === "note" && <ReaderNotePanel onClose={() => setActivePanel(null)} />}
    </div>
  );
};

export default ReaderDetailView;

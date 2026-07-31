import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useEntryStore } from "@/stores/useEntryStore";
import { useReaderStore } from "@/stores/useReaderStore";
import { useI18n } from "@/lib/i18n";
import { translateText } from "@/lib/ipc";
import ReaderToolbar from "./ReaderToolbar";
import ReaderWebView from "./ReaderWebView";
import ReaderSummaryPanel from "./ReaderSummaryPanel";
import ReaderTranslationPanel from "./ReaderTranslationPanel";
import ReaderTaggingPanel from "./ReaderTaggingPanel";
import ReaderNotePanel from "./ReaderNotePanel";
import Button from "@/components/ui/Button";
import { getNote } from "@/lib/ipc";

const ReaderDetailView: React.FC = () => {
  const { t } = useI18n();
  const selectedEntryId = useEntryStore((s) => s.selectedEntryId);
  const readingMode = useAppStore((s) => s.readingMode);

  const entry = useEntryStore((s) =>
    s.entries.find((e) => e.id === selectedEntryId),
  );

  const readerHTML = useReaderStore((s) => s.readerHTML);
  const readerLoading = useReaderStore((s) => s.readerLoading);
  const translationHTML = useReaderStore((s) => s.translationHTML);
  const buildReaderHTML = useReaderStore((s) => s.buildReaderHTML);
  const invalidateReaderContent = useReaderStore((s) => s.invalidateReaderContent);
  const activePanel = useReaderStore((s) => s.activePanel);
  const setActivePanel = useReaderStore((s) => s.setActivePanel);
  const bannerMessage = useReaderStore((s) => s.bannerMessage);
  const bannerType = useReaderStore((s) => s.bannerType);
  const bannerAction = useReaderStore((s) => s.bannerAction);
  const setBanner = useReaderStore((s) => s.setBanner);
  const markStarred = useEntryStore((s) => s.markStarred);
  const [hasNote, setHasNote] = useState(false);
  const handleNoteStateChange = useCallback(
    (entryId: number, nextHasNote: boolean) => {
      if (useEntryStore.getState().selectedEntryId === entryId) {
        setHasNote(nextHasNote);
      }
    },
    [],
  );

  // Subscribe to theme fields
  const fontFamily = useReaderStore((s) => s.fontFamily);
  const fontSize = useReaderStore((s) => s.fontSize);
  const lineHeight = useReaderStore((s) => s.lineHeight);
  const contentWidth = useReaderStore((s) => s.contentWidth);
  const quickStyle = useReaderStore((s) => s.quickStyle);
  const themeMode = useReaderStore((s) => s.themeMode);
  const effectiveTheme = useReaderStore((s) => s.effectiveTheme);
  const themePreset = useReaderStore((s) => s.themePreset);
  const themeTokens = useReaderStore((s) => s.themeTokens);

  // Reset article-scoped state only when the selected article changes.
  useEffect(() => {
    invalidateReaderContent();
    useReaderStore.setState({
      translationHTML: null,
      translationSegments: [],
      translationRequestId: null,
      translationProgress: null,
      translationLoading: false,
      translationError: null,
      summaryResult: null,
      summaryEntryId: selectedEntryId,
      summaryRequestId: null,
      summaryText: "",
      summaryHTML: "",
      summaryLoading: false,
      summaryError: null,
    });
  }, [selectedEntryId, invalidateReaderContent]);

  useEffect(() => {
    let cancelled = false;
    setHasNote(false);
    if (!entry?.id) return;
    void getNote(entry.id)
      .then((note) => {
        if (!cancelled) setHasNote(Boolean(note?.text.trim()));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [entry?.id]);

  // Rebuild presentation when the article or reader theme changes.
  useEffect(() => {
    if (entry?.url && entry?.id) {
      buildReaderHTML(entry.url, entry.id);
    } else if (entry?.url) {
      buildReaderHTML(entry.url);
    }
  }, [
    entry?.id,
    entry?.url,
    fontFamily,
    fontSize,
    lineHeight,
    contentWidth,
    quickStyle,
    themeMode,
    effectiveTheme,
    themePreset,
    themeTokens,
    buildReaderHTML,
  ]);

  const readerAreaRef = useRef<HTMLDivElement>(null);

  // ---- Word / selection translation ----
  const [wordPopup, setWordPopup] = useState<{ text: string, result: string, x: number, y: number } | null>(null);
  const [wordLoading, setWordLoading] = useState(false);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "oasis-word-translate") {
        const txt: string = e.data.text || "";
        // Convert iframe-relative mouse coords to reader-container-relative
        const rArea = readerAreaRef.current;
        const iframe = rArea?.querySelector("iframe");
        const iframeRect = iframe?.getBoundingClientRect();
        const x = (e.data.x ?? 200) + (iframeRect?.left ?? 0) - (rArea?.getBoundingClientRect().left ?? 0);
        const y = (e.data.y ?? 200) + (iframeRect?.top ?? 0) - (rArea?.getBoundingClientRect().top ?? 0);
        setWordPopup({ text: txt, result: "", x, y });
        setWordLoading(true);
        translateText(txt, useReaderStore.getState().translationTargetLanguage)
          .then((res) => {
            setWordPopup((prev) => prev ? { ...prev, result: res } : null);
            setWordLoading(false);
          })
          .catch(() => {
            setWordPopup((prev) => prev ? { ...prev, result: "(Translation failed)" } : null);
            setWordLoading(false);
          });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

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
          {t.common.noData}
        </h3>
        <p className="text-sm text-slate-400">
          {t.reader.selectArticle}
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
        hasNote={hasNote}
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
          title={t.reader.copyLink}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {/* ---- Reader content ---- */}
      <div ref={readerAreaRef} className="flex-1 overflow-hidden">
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
      {activePanel === "note" && (
        <ReaderNotePanel
          key={entry.id}
          onClose={() => setActivePanel(null)}
          onNoteStateChange={handleNoteStateChange}
        />
      )}

      {/* ---- Word translation popup ---- */}
      {wordPopup && (() => {
        // Clamp popup to stay inside the reader area (viewport coords).
        const r = readerAreaRef.current?.getBoundingClientRect();
        const popW = 260, popH = 100;
        const left = r ? Math.max(r.left + 8, Math.min(r.right - popW - 8, wordPopup.x + r.left)) : wordPopup.x;
        const top = r ? Math.max(r.top + 4, Math.min(r.bottom - popH - 4, wordPopup.y + r.top + 4)) : wordPopup.y + 4;
        return (
        <div
          className="fixed z-[120] bg-surface border border-border rounded-xl shadow-lg p-3.5 max-w-[260px] animate-in zoom-in-95 fade-in"
          style={{ left, top }}
        >
          {/* Arrow pointing up toward selection */}
          <div className="absolute -top-1.5 left-4 w-3 h-3 bg-surface border-l border-t border-border rotate-45" />

          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[11px] text-slate-400 italic truncate leading-tight">
              "{wordPopup.text}"
            </span>
            <button onClick={() => setWordPopup(null)}
              className="text-slate-300 hover:text-slate-500 flex-shrink-0 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {wordLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Translating...
            </div>
          ) : (
            <p className="text-sm text-slate-800 leading-relaxed">{wordPopup.result}</p>
          )}
        </div>
        );
      })()}
    </div>
  );
};

export default ReaderDetailView;

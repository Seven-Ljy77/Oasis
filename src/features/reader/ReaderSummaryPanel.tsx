import React, { useState, useEffect } from "react";
import { useReaderStore } from "@/stores/useReaderStore";
import { useEntryStore } from "@/stores/useEntryStore";
import { useI18n } from "@/lib/i18n";
import { useResizableHeight } from "@/hooks/useResizableHeight";
import { listen } from "@tauri-apps/api/event";
import Button from "@/components/ui/Button";

const ReaderSummaryPanel: React.FC = () => {
  const { t } = useI18n();
  const { panelRef, dragHandle } = useResizableHeight("summary", 200);
  const summaryOpen = useReaderStore((s) => s.summaryOpen);
  const setSummaryOpen = useReaderStore((s) => s.setSummaryOpen);

  // Auto-expand when panel first opens
  useEffect(() => { setSummaryOpen(true); }, []);
  const summaryTargetLanguage = useReaderStore((s) => s.summaryTargetLanguage);
  const setSummaryTargetLanguage = useReaderStore((s) => s.setSummaryTargetLanguage);
  const summaryDetailLevel = useReaderStore((s) => s.summaryDetailLevel);
  const setSummaryDetailLevel = useReaderStore((s) => s.setSummaryDetailLevel);
  const summaryAutoEnabled = useReaderStore((s) => s.summaryAutoEnabled);
  const setSummaryAutoEnabled = useReaderStore((s) => s.setSummaryAutoEnabled);
  const summaryText = useReaderStore((s) => s.summaryText);
  const summaryHTML = useReaderStore((s) => s.summaryHTML);
  const setSummaryText = useReaderStore((s) => s.setSummaryText);
  const summaryLoading = useReaderStore((s) => s.summaryLoading);
  const setSummaryLoading = useReaderStore((s) => s.setSummaryLoading);

  const selectedEntryId = useEntryStore((s) => s.selectedEntryId);
  const loadSummary = useReaderStore((s) => s.loadSummary);

  const [streamingDots, setStreamingDots] = useState("");

  // Simulated streaming animation
  useEffect(() => {
    if (!summaryLoading) return;
    const interval = setInterval(() => {
      setStreamingDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [summaryLoading]);

  // Listen for streaming summary tokens from backend
  useEffect(() => {
    const unlisten = listen<{ entry_id: number; token: string; is_complete: boolean }>(
      "summary-token",
      (event) => {
        if (event.payload.is_complete) {
          setSummaryLoading(false);
        } else {
          const current = useReaderStore.getState().summaryText;
          setSummaryText(current + event.payload.token);
        }
      },
    );
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const languages = [
    { value: "zh-CN", label: "Chinese (Simplified)" },
    { value: "en", label: "English" },
    { value: "ja", label: "Japanese" },
    { value: "ko", label: "Korean" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "es", label: "Spanish" },
    { value: "pt", label: "Portuguese" },
    { value: "ru", label: "Russian" },
    { value: "ar", label: "Arabic" },
    { value: "it", label: "Italian" },
    { value: "vi", label: "Vietnamese" },
  ];

  const detailLevels: { value: "short" | "medium" | "detailed"; label: string }[] = [
    { value: "short", label: t.summary.short },
    { value: "medium", label: t.summary.medium },
    { value: "detailed", label: t.summary.detailed },
  ];

  const handleGenerate = async () => {
    if (!selectedEntryId) return;
    setSummaryText("");
    setSummaryLoading(true);
    try {
      await loadSummary(selectedEntryId, summaryDetailLevel);
    } catch {
      setSummaryLoading(false);
    }
  };

  // Auto-summary: when enabled and entry changes, auto-generate after 1s debounce.
  useEffect(() => {
    if (!summaryAutoEnabled || !selectedEntryId) return;
    const timer = setTimeout(() => {
      handleGenerate();
    }, 1000);
    return () => clearTimeout(timer);
  }, [selectedEntryId, summaryAutoEnabled]);

  const handleCopy = () => {
    if (summaryText) navigator.clipboard.writeText(summaryText);
  };

  const handleClear = () => {
    setSummaryText("");
  };

  if (!summaryOpen) {
    return (
      <button
        onClick={() => setSummaryOpen(true)}
        className="h-10 border-t border-border bg-surface-secondary flex items-center gap-2 px-3 text-sm text-slate-500 hover:text-slate-700 hover:bg-surface-tertiary transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
        <span>{t.summary.title}</span>
        {summaryText && <span className="w-2 h-2 rounded-full bg-accent" />}
      </button>
    );
  }

  return (
    <div ref={panelRef as any} className="border-t border-border bg-surface flex flex-col" style={{ maxHeight: "40vh" }}>
      {dragHandle}
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-secondary">
        {/* Target language */}
        <select
          value={summaryTargetLanguage}
          onChange={(e) => setSummaryTargetLanguage(e.target.value)}
          className="h-7 px-1.5 text-xs rounded border border-border bg-surface focus:border-accent focus:outline-none"
        >
          {languages.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        {/* Detail level */}
        <div className="flex gap-0.5 bg-surface-tertiary rounded p-0.5">
          {detailLevels.map((dl) => (
            <button
              key={dl.value}
              onClick={() => setSummaryDetailLevel(dl.value)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                summaryDetailLevel === dl.value
                  ? "bg-surface text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {dl.label}
            </button>
          ))}
        </div>

        {/* Auto-summary toggle */}
        <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={summaryAutoEnabled}
            onChange={(e) => setSummaryAutoEnabled(e.target.checked)}
            className="rounded border-slate-300 text-accent w-3 h-3"
          />
          {t.summary.autoSummary}
        </label>

        <div className="flex-1" />

        {/* Action buttons */}
        <Button variant="ghost" size="sm" onClick={handleGenerate} loading={summaryLoading}>
          {t.summary.generate}
        </Button>
        {summaryLoading && (
          <Button variant="ghost" size="sm" onClick={() => setSummaryLoading(false)}>
            {t.summary.abort}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!summaryText}>
          {t.summary.copy}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleClear} disabled={!summaryText}>
          {t.summary.clear}
        </Button>
        <button
          onClick={() => useReaderStore.setState({ activePanel: null })}
          className="p-0.5 rounded hover:bg-surface-tertiary text-slate-400 hover:text-slate-600 transition-colors ml-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Meta row */}
      {summaryText && (
        <div className="px-3 py-1 text-[10px] text-slate-400 border-b border-border/50 flex items-center gap-3">
          <span>{t.summary.targetLanguage}: {languages.find((l) => l.value === summaryTargetLanguage)?.label}</span>
          <span>{t.summary.detailLevel}: {summaryDetailLevel}</span>
          <span>Generated: {new Date().toLocaleTimeString()}</span>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {summaryLoading && (
          <div className="text-sm text-slate-500 italic animate-pulse">
            {t.summary.generating}{streamingDots}
          </div>
        )}
        {!summaryLoading && !summaryText && (
          <div className="text-sm text-slate-400 text-center py-4">
            {t.summary.ready}
          </div>
        )}
        {!summaryLoading && summaryText && (
          <div className="prose prose-sm max-w-none text-slate-700 text-sm leading-relaxed">
            {summaryHTML ? (
              <div dangerouslySetInnerHTML={{ __html: summaryHTML }} />
            ) : (
              <div className="whitespace-pre-wrap">{summaryText}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReaderSummaryPanel;

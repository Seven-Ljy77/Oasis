import React, { useState } from "react";
import { useReaderStore } from "@/stores/useReaderStore";
import Button from "@/components/ui/Button";

const ReaderSummaryPanel: React.FC = () => {
  const summaryOpen = useReaderStore((s) => s.summaryOpen);
  const setSummaryOpen = useReaderStore((s) => s.setSummaryOpen);
  const summaryTargetLanguage = useReaderStore((s) => s.summaryTargetLanguage);
  const setSummaryTargetLanguage = useReaderStore((s) => s.setSummaryTargetLanguage);
  const summaryDetailLevel = useReaderStore((s) => s.summaryDetailLevel);
  const setSummaryDetailLevel = useReaderStore((s) => s.setSummaryDetailLevel);
  const summaryAutoEnabled = useReaderStore((s) => s.summaryAutoEnabled);
  const setSummaryAutoEnabled = useReaderStore((s) => s.setSummaryAutoEnabled);
  const summaryText = useReaderStore((s) => s.summaryText);
  const setSummaryText = useReaderStore((s) => s.setSummaryText);
  const summaryLoading = useReaderStore((s) => s.summaryLoading);
  const setSummaryLoading = useReaderStore((s) => s.setSummaryLoading);

  const [streamingDots, setStreamingDots] = useState("");

  // Simulated streaming animation
  React.useEffect(() => {
    if (!summaryLoading) return;
    const interval = setInterval(() => {
      setStreamingDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [summaryLoading]);

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
    { value: "short", label: "Short" },
    { value: "medium", label: "Medium" },
    { value: "detailed", label: "Detailed" },
  ];

  const handleGenerate = async () => {
    setSummaryLoading(true);
    // TODO: call generateSummary IPC and listen for streaming tokens
    // For now, simulate a delay
    setTimeout(() => {
      setSummaryText(
        "This is a placeholder summary. Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
          "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, " +
          "quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      );
      setSummaryLoading(false);
    }, 2000);
  };

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
        <span>Summary</span>
        {summaryText && <span className="w-2 h-2 rounded-full bg-accent" />}
      </button>
    );
  }

  return (
    <div className="border-t border-border bg-surface flex flex-col" style={{ maxHeight: "40vh" }}>
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-secondary">
        <button
          onClick={() => setSummaryOpen(false)}
          className="p-0.5 rounded hover:bg-surface-tertiary text-slate-400 hover:text-slate-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

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
          Auto
        </label>

        <div className="flex-1" />

        {/* Action buttons */}
        <Button variant="ghost" size="sm" onClick={handleGenerate} loading={summaryLoading}>
          Generate
        </Button>
        {summaryLoading && (
          <Button variant="ghost" size="sm" onClick={() => setSummaryLoading(false)}>
            Abort
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!summaryText}>
          Copy
        </Button>
        <Button variant="ghost" size="sm" onClick={handleClear} disabled={!summaryText}>
          Clear
        </Button>
      </div>

      {/* Meta row */}
      {summaryText && (
        <div className="px-3 py-1 text-[10px] text-slate-400 border-b border-border/50 flex items-center gap-3">
          <span>Language: {languages.find((l) => l.value === summaryTargetLanguage)?.label}</span>
          <span>Detail: {summaryDetailLevel}</span>
          <span>Generated: {new Date().toLocaleTimeString()}</span>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {summaryLoading && (
          <div className="text-sm text-slate-500 italic animate-pulse">
            Generating summary{streamingDots}
          </div>
        )}
        {!summaryLoading && !summaryText && (
          <div className="text-sm text-slate-400 text-center py-4">
            No summary yet. Click "Generate" to create one.
          </div>
        )}
        {!summaryLoading && summaryText && (
          <div className="prose prose-sm max-w-none text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
            {summaryText}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReaderSummaryPanel;

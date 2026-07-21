import React, { useState } from "react";
import { useReaderStore } from "@/stores/useReaderStore";
import { useEntryStore } from "@/stores/useEntryStore";
import { useResizableHeight } from "@/hooks/useResizableHeight";
import { startTranslation, getTranslationSegments, buildTranslationHTML } from "@/lib/ipc";
import Button from "@/components/ui/Button";

const ReaderTranslationPanel: React.FC = () => {
  const { panelRef, dragHandle } = useResizableHeight("translation", 200);
  const selectedEntryId = useEntryStore((s) => s.selectedEntryId);
  const translationEnabled = useReaderStore((s) => s.translationEnabled);
  const setTranslationEnabled = useReaderStore((s) => s.setTranslationEnabled);
  const translationBilingual = useReaderStore((s) => s.translationBilingual);
  const setTranslationBilingual = useReaderStore((s) => s.setTranslationBilingual);
  const translationTargetLanguage = useReaderStore((s) => s.translationTargetLanguage);
  const setTranslationTargetLanguage = useReaderStore((s) => s.setTranslationTargetLanguage);
  const translationConcurrency = useReaderStore((s) => s.translationConcurrency);
  const setTranslationConcurrency = useReaderStore((s) => s.setTranslationConcurrency);
  const translationPromptStrategy = useReaderStore((s) => s.translationPromptStrategy);
  const setTranslationPromptStrategy = useReaderStore((s) => s.setTranslationPromptStrategy);
  const translationProgress = useReaderStore((s) => s.translationProgress);
  const setTranslationProgress = useReaderStore((s) => s.setTranslationProgress);

  const [collapsed, setCollapsed] = useState(false); // start expanded
  const [translationLoading, setTranslationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const translationHTML = useReaderStore((s) => s.translationHTML);

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

  const handleStart = async () => {
    if (!selectedEntryId) return;
    setError(null);
    setTranslationLoading(true);

    try {
      const result: any = await startTranslation(selectedEntryId, translationTargetLanguage);
      const total = result?.total_segments ?? 0;
      useReaderStore.setState({ translationSegments: result?.segments ?? [] });
      setTranslationProgress({ completed: total, total });
      if (total > 0) {
        try {
          const html = await buildTranslationHTML(selectedEntryId, translationTargetLanguage, translationBilingual);
          useReaderStore.setState({ translationHTML: html });
        } catch { /* ok if HTML build fails */ }
      } else if ((result as any)?.error) {
        setError((result as any).error);
      } else {
        setError("Translation produced 0 segments — article content may be too short or LLM call failed");
      }
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.message || e?.error || (e && typeof e === "object" ? JSON.stringify(e) : String(e));
      setError(msg);
    } finally {
      setTranslationLoading(false);
    }
  };

  const getStatusText = () => {
    if (translationLoading) return "Translating...";
    if (translationProgress) return `Translation complete: ${translationProgress.total} segments`;
    if (translationEnabled) return "Translation ready — click Start to begin";
    return "Translation disabled";
  };

  // Collapsed toggle bar
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="h-10 border-t border-border bg-surface-secondary flex items-center gap-2 px-3 text-sm text-slate-500 hover:text-slate-700 hover:bg-surface-tertiary transition-colors w-full"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
        <span>Translation</span>
        {translationProgress && <span className="text-xs text-green-500 ml-auto">{translationProgress.total} segments</span>}
        {translationLoading && <span className="text-xs text-accent ml-auto">Translating...</span>}
      </button>
    );
  }

  return (
    <div ref={panelRef as any} className="border-t border-border bg-surface flex flex-col" style={{ maxHeight: "40vh" }}>
      {dragHandle}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-secondary">
        <button onClick={() => setCollapsed(true)} className="p-0.5 rounded hover:bg-surface-tertiary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-700">Translation</h3>
        <div className="flex-1" />
      </div>
      <div className="p-4 space-y-3 overflow-y-auto">

      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">
          {translationBilingual ? "Bilingual mode" : "Translation"}
        </span>
        <Button variant="primary" size="sm" onClick={handleStart} disabled={!selectedEntryId || translationLoading}>
          {translationLoading ? "Translating..." : "Start Translation"}
        </Button>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Target Language</label>
        <select
          value={translationTargetLanguage}
          onChange={(e) => setTranslationTargetLanguage(e.target.value)}
          className="w-full h-8 px-2 text-xs rounded-md border border-border bg-surface focus:border-accent focus:outline-none"
        >
          {languages.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={translationBilingual}
          onChange={async (e) => {
            setTranslationBilingual(e.target.checked);
            if (selectedEntryId && translationProgress) {
              try {
                const html = await buildTranslationHTML(selectedEntryId, translationTargetLanguage, e.target.checked);
                useReaderStore.setState({ translationHTML: html });
              } catch {}
            }
          }}
          className="rounded border-slate-300 text-accent w-3.5 h-3.5"
        />
        <span className="text-sm text-slate-600">Bilingual (show original + translation)</span>
      </label>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Concurrency: {translationConcurrency}</label>
        <input
          type="range" min="1" max="5" step="1"
          value={translationConcurrency}
          onChange={(e) => setTranslationConcurrency(parseInt(e.target.value))}
          className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Prompt Strategy</label>
        <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5">
          <button
            onClick={() => setTranslationPromptStrategy("standard")}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
              translationPromptStrategy === "standard" ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>Standard</button>
          <button
            onClick={() => setTranslationPromptStrategy("hy_mt_optimized")}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
              translationPromptStrategy === "hy_mt_optimized" ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>HY-MT Opt</button>
        </div>
      </div>

      <div className="text-xs text-slate-400 pt-1 border-t border-border/50">{getStatusText()}</div>

      {error && (
        <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded p-2">{error}</div>
      )}
      </div>
    </div>
  );
};

export default ReaderTranslationPanel;

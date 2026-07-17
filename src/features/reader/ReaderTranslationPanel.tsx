import React, { useState, useEffect } from "react";
import { useReaderStore } from "@/stores/useReaderStore";
import { useEntryStore } from "@/stores/useEntryStore";
import { startTranslation, getTranslationSegments, buildTranslationHTML } from "@/lib/ipc";
import { listen } from "@tauri-apps/api/event";
import Button from "@/components/ui/Button";

const ReaderTranslationPanel: React.FC = () => {
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

  const [collapsed, setCollapsed] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSegments, setCompletedSegments] = useState<string[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(0);

  // Listen for translation segment events from backend
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let completed: string[] = [];
    let srcTexts: string[] = [];

    listen<{ entry_id: number; segment_id: string; text: string; source_text?: string; status: string; total?: number; error?: string }>(
      "translation-segment",
      (event) => {
        if (event.payload.entry_id !== selectedEntryId) return;
        const { status, text, total, error: errMsg } = event.payload;

        if (status === "started") {
          setTranslating(true);
          setError(null);
          completed = [];
          srcTexts = [];
          setCompletedSegments([]);
        } else if (status === "completed") {
          completed.push(text);
          setCompletedSegments([...completed]);
          if (total) setSegmentsLoading(total);
          // Build progressive HTML with source texts + loading/filled translation boxes
          buildProgressiveHTML(completed, srcTexts, total ?? 3);
        } else if (status === "done") {
          setTranslating(false);
          if (selectedEntryId) {
            getTranslationSegments(selectedEntryId, translationTargetLanguage)
              .then((segs) => {
                useReaderStore.setState({ translationSegments: segs });
                setTranslationProgress({ completed: segs.length, total: segs.length });
              })
              .catch(() => {});
            buildTranslationHTML(selectedEntryId, translationTargetLanguage, translationBilingual)
              .then((html) => useReaderStore.setState({ translationHTML: html }))
              .catch(() => {});
          }
        } else if (status === "error") {
          setTranslating(false);
          setError(errMsg || "Translation failed");
        }
      },
    ).then((fn) => { unsub = fn; });

    // Build skeleton + completed translation HTML for reader area
    function buildProgressiveHTML(completed: string[], _srcs: string[], total: number) {
      let html = "";
      for (let i = 0; i < total; i++) {
        html += `<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:0.8rem 1rem;margin:0.5em 0;">`;
        if (i < completed.length) {
          html += `<p style="margin:0;color:#374151;font-size:15px;line-height:1.7;">${completed[i]}</p>`;
        } else {
          html += `<div style="display:flex;gap:6px;">
            <span style="width:8px;height:8px;border-radius:50%;background:#a7f3d0;animation:pulse 1.4s infinite;"></span>
            <span style="width:8px;height:8px;border-radius:50%;background:#6ee7b7;animation:pulse 1.4s 0.2s infinite;"></span>
            <span style="width:8px;height:8px;border-radius:50%;background:#34d399;animation:pulse 1.4s 0.4s infinite;"></span>
          </div>`;
        }
        html += `</div>`;
      }
      useReaderStore.setState({
        translationHTML: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
          @keyframes pulse { 0%,80%,100% { opacity:0.3; } 40% { opacity:1; } }
          body { font-family:Georgia,serif; font-size:15px; line-height:1.7; max-width:720px; margin:2rem auto; padding:0 1rem; color:#1a1a1a; background:#faf9f7; }
          @media (prefers-color-scheme:dark) { body { background:#1a1a1a; color:#e8e6e3; } }
        </style></head><body>${html}</body></html>`,
      });
    }

    return () => { unsub?.(); };
  }, [selectedEntryId, translationTargetLanguage, translationBilingual]);

  const handleStart = () => {
    if (!selectedEntryId) return;
    setError(null);
    setTranslating(true);
    setCompletedSegments([]);
    startTranslation(selectedEntryId, translationTargetLanguage, translationConcurrency)
      .catch((e: any) => {
        setError(typeof e === "string" ? e : e?.message || String(e));
        setTranslating(false);
      });
  };

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

  const getStatusText = () => {
    if (translating) return `Translating: ${completedSegments.length} / ${segmentsLoading || "..."} segments`;
    if (translationProgress) return `Complete: ${translationProgress.total} segments`;
    return "Ready";
  };

  if (collapsed) {
    return (
      <button onClick={() => setCollapsed(false)}
        className="h-10 border-t border-border bg-surface-secondary flex items-center gap-2 px-3 text-sm text-slate-500 hover:text-slate-700 hover:bg-surface-tertiary transition-colors w-full"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
        <span>Translation</span>
        {translating && <span className="text-xs text-accent ml-auto animate-pulse">Translating...</span>}
        {translationProgress && !translating && <span className="text-xs text-green-500 ml-auto">{translationProgress.total} segments</span>}
      </button>
    );
  }

  return (
    <div className="border-t border-border bg-surface flex flex-col" style={{ maxHeight: "40vh" }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-secondary">
        <button onClick={() => setCollapsed(true)} className="p-0.5 rounded hover:bg-surface-tertiary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-700">Translation</h3>
        <div className="flex-1" />
      </div>
      <div className="p-4 space-y-3 overflow-y-auto">
        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm" onClick={handleStart} disabled={!selectedEntryId || translating}>
            {translating ? "Translating..." : "Start Translation"}
          </Button>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Target Language</label>
          <select value={translationTargetLanguage} onChange={(e) => setTranslationTargetLanguage(e.target.value)}
            className="w-full h-8 px-2 text-xs rounded-md border border-border bg-surface focus:border-accent focus:outline-none">
            {languages.map((l) => (<option key={l.value} value={l.value}>{l.label}</option>))}
          </select>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={translationBilingual}
            onChange={async (e) => {
              setTranslationBilingual(e.target.checked);
              if (selectedEntryId && translationProgress) {
                try {
                  const html = await buildTranslationHTML(selectedEntryId, translationTargetLanguage, e.target.checked);
                  useReaderStore.setState({ translationHTML: html });
                } catch {}
              }
            }}
            className="rounded border-slate-300 text-accent w-3.5 h-3.5" />
          <span className="text-sm text-slate-600">Bilingual (show original + translation)</span>
        </label>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Concurrency: {translationConcurrency}</label>
          <input type="range" min="1" max="5" step="1" value={translationConcurrency}
            onChange={(e) => setTranslationConcurrency(parseInt(e.target.value))}
            className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-accent" />
          <div className="flex justify-between text-[10px] text-slate-400 mt-0.5"><span>1</span><span>5</span></div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Prompt Strategy</label>
          <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5">
            <button onClick={() => setTranslationPromptStrategy("standard")}
              className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${translationPromptStrategy === "standard" ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Standard</button>
            <button onClick={() => setTranslationPromptStrategy("hy_mt_optimized")}
              className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${translationPromptStrategy === "hy_mt_optimized" ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>HY-MT Opt</button>
          </div>
        </div>

        <div className="text-xs text-slate-400 pt-1 border-t border-border/50">{getStatusText()}</div>
        {error && <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
      </div>
    </div>
  );
};

export default ReaderTranslationPanel;

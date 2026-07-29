import React, { useState, useRef, useEffect } from "react";
import { useReaderStore } from "@/stores/useReaderStore";
import { useEntryStore } from "@/stores/useEntryStore";
import { useI18n } from "@/lib/i18n";
import { useResizableHeight } from "@/hooks/useResizableHeight";
import { startTranslation, getTranslationSegments } from "@/lib/ipc";
import Button from "@/components/ui/Button";

const ReaderTranslationPanel: React.FC = () => {
  const { t } = useI18n();
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
  const setTranslationProgress = useReaderStore((s) => s.setTranslationProgress);

  const [translationLoading, setTranslationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segmentCount, setSegmentCount] = useState(0);
  const cancelledRef = useRef(false);

  // When bilingual is toggled, broadcast to iframe to show/hide all originals.
  useEffect(() => {
    const iframe = document.querySelector('iframe[title="Reader content"]') as HTMLIFrameElement | null;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: "oasis-toggle-bilingual", showOriginal: translationBilingual },
        "*",
      );
    }
  }, [translationBilingual]);

  const handleStart = async () => {
    if (!selectedEntryId) return;
    setError(null);
    setTranslationLoading(true);
    setSegmentCount(0);
    cancelledRef.current = false;
    try {
      await startTranslation(selectedEntryId, translationTargetLanguage);
      const pollSegments = async () => {
        if (cancelledRef.current) return;
        const segs = await getTranslationSegments(selectedEntryId, translationTargetLanguage);
        if (!segs || segs.length === 0) return;
        if (cancelledRef.current) return;
        const iframe = document.querySelector('iframe[title="Reader content"]') as HTMLIFrameElement | null;
        const completedCount = segs.filter((s: any) => s.translated_text).length;
        if (completedCount > 0 && iframe?.contentWindow) {
          for (const seg of segs) {
            if (seg.translated_text) {
              iframe.contentWindow.postMessage(
                {
                  type: "oasis-translation",
                  orderIndex: seg.order_index,
                  text: seg.translated_text,
                  showOriginal: useReaderStore.getState().translationBilingual,
                },
                "*",
              );
            }
          }
        }
        setSegmentCount(completedCount);
        setTranslationProgress({ completed: completedCount, total: segs.length });
      };
      await pollSegments();
      for (let i = 0; i < 10 && !cancelledRef.current; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        await pollSegments();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setTranslationLoading(false);
    }
  };

  const handleClear = () => {
    cancelledRef.current = true;
    const iframe = document.querySelector('iframe[title="Reader content"]') as HTMLIFrameElement | null;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: "oasis-clear-translations" }, "*");
    }
    setTranslationEnabled(false);
    setSegmentCount(0);
    setTranslationProgress(null);
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

  const statusText = translationLoading
    ? `${t.translation.translating} (${segmentCount} segments)`
    : segmentCount > 0
      ? `${t.translation.completed}: ${segmentCount} segments`
      : t.translation.ready;

  return (
    <div ref={panelRef as any} className="border-t border-border bg-surface-secondary flex flex-col">
      {dragHandle}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <h3 className="text-sm font-semibold text-slate-700">{t.translation.title}</h3>
        <div className="flex items-center gap-2">
          {segmentCount > 0 && !translationLoading && (
            <button
              onClick={handleClear}
              className="text-xs text-red-500 hover:text-red-600 transition-colors"
            >
              {t.common.clear}
            </button>
          )}
          <button
            onClick={() => useReaderStore.setState({ activePanel: null })}
            className="p-0.5 rounded hover:bg-surface-tertiary text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto">
        <div>
          <Button variant="primary" size="sm" onClick={handleStart} disabled={!selectedEntryId || translationLoading}>
            {translationLoading ? t.translation.translating : t.translation.start}
          </Button>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{t.translation.targetLanguage}</label>
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
            onChange={(e) => setTranslationBilingual(e.target.checked)}
            className="rounded border-slate-300 text-accent"
          />
          <span className="text-sm text-slate-600">{t.translation.bilingual}</span>
        </label>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{t.translation.concurrency}: {translationConcurrency}</label>
          <input
            type="range" min="1" max="5" step="1"
            value={translationConcurrency}
            onChange={(e) => setTranslationConcurrency(parseInt(e.target.value))}
            className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
          />
        </div>

        {/* Status text */}
        <p className="text-xs text-slate-400">{statusText}</p>

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
};

export default ReaderTranslationPanel;

import React, { useRef, useEffect } from "react";
import { useReaderStore } from "@/stores/useReaderStore";
import { useEntryStore } from "@/stores/useEntryStore";
import { useI18n } from "@/lib/i18n";
import { useResizableHeight } from "@/hooks/useResizableHeight";
import { startTranslation, getTranslationSegments } from "@/lib/ipc";
import { listen } from "@tauri-apps/api/event";
import Button from "@/components/ui/Button";

let translationRequestSequence = 0;

function clearIframeTranslations() {
  const iframe = document.querySelector(
    'iframe[title="Reader content"]',
  ) as HTMLIFrameElement | null;
  iframe?.contentWindow?.postMessage(
    { type: "oasis-clear-translations" },
    "*",
  );
}

const ReaderTranslationPanel: React.FC = () => {
  const { t } = useI18n();
  const { panelRef, dragHandle } = useResizableHeight("translation", 200);
  const selectedEntryId = useEntryStore((s) => s.selectedEntryId);
  const setTranslationEnabled = useReaderStore((s) => s.setTranslationEnabled);
  const translationBilingual = useReaderStore((s) => s.translationBilingual);
  const setTranslationBilingual = useReaderStore((s) => s.setTranslationBilingual);
  const translationTargetLanguage = useReaderStore((s) => s.translationTargetLanguage);
  const setTranslationTargetLanguage = useReaderStore((s) => s.setTranslationTargetLanguage);
  const translationConcurrency = useReaderStore((s) => s.translationConcurrency);
  const setTranslationConcurrency = useReaderStore((s) => s.setTranslationConcurrency);
  const setTranslationProgress = useReaderStore((s) => s.setTranslationProgress);
  const activeTranslationRequestId = useReaderStore(
    (s) => s.translationRequestId,
  );
  const translationLoading = useReaderStore((s) => s.translationLoading);
  const error = useReaderStore((s) => s.translationError);
  const segmentCount = useReaderStore((s) => s.translationSegments.length);
  const translationProgress = useReaderStore((s) => s.translationProgress);

  const cancelledRef = useRef(false);
  const requestIdRef = useRef<string | null>(activeTranslationRequestId);
  const completedSegmentsRef = useRef(
    new Set(
      useReaderStore
        .getState()
        .translationSegments.map((segment) => segment.segment_id),
    ),
  );
  const previousEntryIdRef = useRef(selectedEntryId);

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

  useEffect(() => {
    if (previousEntryIdRef.current === selectedEntryId) return;
    previousEntryIdRef.current = selectedEntryId;
    const activeRequestId = requestIdRef.current;
    requestIdRef.current = null;
    cancelledRef.current = true;
    completedSegmentsRef.current.clear();
    setTranslationProgress(null);
    if (activeRequestId) {
      useReaderStore.setState((state) =>
        state.translationRequestId === activeRequestId
          ? {
              translationRequestId: null,
              translationLoading: false,
            }
          : {},
      );
    }
  }, [selectedEntryId, setTranslationProgress]);

  useEffect(() => {
    if (activeTranslationRequestId === requestIdRef.current) return;
    if (activeTranslationRequestId === null) {
      requestIdRef.current = null;
      cancelledRef.current = true;
      completedSegmentsRef.current.clear();
      setTranslationProgress(null);
      return;
    }

    requestIdRef.current = activeTranslationRequestId;
    cancelledRef.current = false;
    completedSegmentsRef.current = new Set(
      useReaderStore
        .getState()
        .translationSegments.map((segment) => segment.segment_id),
    );
  }, [activeTranslationRequestId, setTranslationProgress]);

  useEffect(() => {
    const unlisten = listen<{
      entry_id: number;
      request_id: string;
      target_language: string;
      status: "started" | "segment_completed" | "completed" | "failed";
      segment_id?: string;
      order_index?: number;
      translated_text?: string;
      total_segments?: number;
      error?: string;
    }>("translation-progress", (event) => {
      const payload = event.payload;
      if (
        payload.entry_id !== useEntryStore.getState().selectedEntryId ||
        payload.request_id !== requestIdRef.current ||
        payload.request_id !==
          useReaderStore.getState().translationRequestId ||
        payload.target_language !==
          useReaderStore.getState().translationTargetLanguage ||
        cancelledRef.current
      ) {
        return;
      }

      if (payload.status === "started") {
        completedSegmentsRef.current.clear();
        setTranslationProgress(null);
        clearIframeTranslations();
        useReaderStore.setState({
          translationSegments: [],
          translationLoading: true,
          translationError: null,
          translationProgress: null,
        });
      } else if (
        payload.status === "segment_completed" &&
        payload.segment_id &&
        payload.order_index !== undefined &&
        payload.translated_text !== undefined
      ) {
        completedSegmentsRef.current.add(payload.segment_id);
        const completed = completedSegmentsRef.current.size;
        setTranslationProgress({
          completed,
          total: payload.total_segments ?? Math.max(completed, 1),
        });
        useReaderStore.setState((state) => {
          const segment = {
            segment_id: payload.segment_id!,
            source_text: "",
            translated_text: payload.translated_text!,
            order_index: payload.order_index!,
            status: "completed" as const,
          };
          const existingIndex = state.translationSegments.findIndex(
            (candidate) => candidate.segment_id === segment.segment_id,
          );
          const translationSegments = [...state.translationSegments];
          if (existingIndex >= 0) {
            translationSegments[existingIndex] = segment;
          } else {
            translationSegments.push(segment);
          }
          translationSegments.sort((a, b) => a.order_index - b.order_index);
          return { translationSegments };
        });
        const iframe = document.querySelector(
          'iframe[title="Reader content"]',
        ) as HTMLIFrameElement | null;
        iframe?.contentWindow?.postMessage(
          {
            type: "oasis-translation",
            orderIndex: payload.order_index,
            text: payload.translated_text,
            showOriginal: useReaderStore.getState().translationBilingual,
          },
          "*",
        );
      } else if (payload.status === "failed") {
        requestIdRef.current = null;
        cancelledRef.current = true;
        useReaderStore.setState({
          translationRequestId: null,
          translationLoading: false,
          translationError: payload.error ?? "Translation failed",
        });
      }
    });

    return () => {
      void unlisten.then((dispose) => dispose()).catch(() => undefined);
      // Hiding the panel is not cancellation. handleStart remains alive and
      // reconciles the final persisted segments when the backend completes.
    };
  }, [setTranslationProgress]);

  const handleStart = async () => {
    if (!selectedEntryId) return;
    const requestId = "translation-" + ++translationRequestSequence;
    requestIdRef.current = requestId;
    clearIframeTranslations();
    cancelledRef.current = false;
    completedSegmentsRef.current.clear();
    setTranslationProgress(null);
    useReaderStore.setState({
      translationRequestId: requestId,
      translationSegments: [],
      translationLoading: true,
      translationError: null,
      translationProgress: null,
    });
    try {
      await startTranslation(
        selectedEntryId,
        translationTargetLanguage,
        translationConcurrency,
        requestId,
      );
      if (
        requestIdRef.current !== requestId ||
        useReaderStore.getState().translationRequestId !== requestId ||
        cancelledRef.current ||
        useEntryStore.getState().selectedEntryId !== selectedEntryId ||
        useReaderStore.getState().translationTargetLanguage !==
          translationTargetLanguage
      ) {
        return;
      }
      const segs = await getTranslationSegments(
        selectedEntryId,
        translationTargetLanguage,
      );
      if (
        requestIdRef.current !== requestId ||
        useReaderStore.getState().translationRequestId !== requestId ||
        cancelledRef.current ||
        useEntryStore.getState().selectedEntryId !== selectedEntryId
      ) {
        return;
      }
      const iframe = document.querySelector(
        'iframe[title="Reader content"]',
      ) as HTMLIFrameElement | null;
      for (const seg of segs) {
        if (seg.translated_text) {
          iframe?.contentWindow?.postMessage(
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
      setTranslationProgress({ completed: segs.length, total: segs.length });
      useReaderStore.setState({ translationSegments: segs });
    } catch (err) {
      if (
        requestIdRef.current === requestId &&
        useReaderStore.getState().translationRequestId === requestId &&
        useEntryStore.getState().selectedEntryId === selectedEntryId
      ) {
        requestIdRef.current = null;
        cancelledRef.current = true;
        useReaderStore.setState({
          translationRequestId: null,
          translationLoading: false,
          translationError: err instanceof Error ? err.message
            : typeof err === "string" ? err
            : JSON.stringify(err),
        });
      }
    } finally {
      if (
        requestIdRef.current === requestId &&
        useReaderStore.getState().translationRequestId === requestId
      ) {
        requestIdRef.current = null;
        cancelledRef.current = true;
        useReaderStore.setState({
          translationRequestId: null,
          translationLoading: false,
        });
      }
    }
  };

  const handleClear = () => {
    requestIdRef.current = null;
    cancelledRef.current = true;
    clearIframeTranslations();
    setTranslationEnabled(false);
    setTranslationProgress(null);
    useReaderStore.setState({
      translationSegments: [],
      translationRequestId: null,
      translationLoading: false,
      translationError: null,
      translationProgress: null,
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

  const statusText = error
    ? t.translation.failed
    : translationLoading
      ? translationProgress?.total
        ? `${t.translation.translating} — ${translationProgress.completed}/${translationProgress.total} ${t.translation.segments}`
        : `${t.translation.translating}...`
      : segmentCount > 0
        ? `${t.translation.completed}: ${segmentCount} ${t.translation.segments}`
        : t.translation.ready;

  return (
    <div ref={panelRef as any} className="border-t border-border bg-surface-secondary flex flex-col">
      {dragHandle}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <h3 className="text-sm font-semibold text-slate-700">{t.translation.title}</h3>
        <div className="flex items-center gap-2">
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
            onChange={(e) => {
              requestIdRef.current = null;
              cancelledRef.current = true;
              completedSegmentsRef.current.clear();
              clearIframeTranslations();
              setTranslationProgress(null);
              setTranslationTargetLanguage(e.target.value);
            }}
            disabled={translationLoading}
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
            disabled={translationLoading}
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

import React, { useState, useEffect } from "react";
import { useReaderStore } from "@/stores/useReaderStore";
import { useEntryStore } from "@/stores/useEntryStore";
import { startTranslation, getTranslationSegments } from "@/lib/ipc";
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
  const translationLoading = useReaderStore((s) => s.translationLoading);
  const translationSegments = useReaderStore((s) => s.translationSegments);
  const loadTranslationSegments = useReaderStore((s) => s.loadTranslationSegments);

  const [segmentCount, setSegmentCount] = useState(0);

  // Listen for translation segment events from backend
  useEffect(() => {
    const unlisten = listen<{
      entry_id: number;
      segment_id: string;
      text: string;
      status: string;
      total?: number;
      error?: string;
    }>("translation-segment", (event) => {
      const { status, total } = event.payload;
      if (status === "started") {
        useReaderStore.setState({ translationLoading: true });
        setSegmentCount(0);
      } else if (status === "completed") {
        setSegmentCount((c) => c + 1);
        setTranslationProgress({
          completed: 0,
          total: total ?? 0,
        });
      } else if (status === "done") {
        useReaderStore.setState({ translationLoading: false });
        if (selectedEntryId) {
          loadTranslationSegments(selectedEntryId, translationTargetLanguage);
        }
      } else if (status === "error") {
        useReaderStore.setState({ translationLoading: false });
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [selectedEntryId, translationTargetLanguage]);

  // Start translation when enabled
  const handleEnableToggle = async (checked: boolean) => {
    setTranslationEnabled(checked);
    if (checked && selectedEntryId) {
      try {
        await startTranslation(selectedEntryId, translationTargetLanguage);
      } catch (e) {
        console.error("Translation start failed:", e);
        setTranslationEnabled(false);
      }
    }
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

  const handleResume = async () => {
    if (selectedEntryId) {
      try {
        const cached = await getTranslationSegments(selectedEntryId, translationTargetLanguage);
        if (cached.length > 0) {
          useReaderStore.getState().loadTranslationSegments(selectedEntryId, translationTargetLanguage);
          setTranslationProgress({ completed: cached.length, total: cached.length });
        } else {
          await startTranslation(selectedEntryId, translationTargetLanguage);
        }
      } catch (e) {
        console.error("Resume failed:", e);
      }
    }
  };

  const getStatusText = () => {
    if (translationLoading) {
      return `Translating: ${segmentCount} segments completed...`;
    }
    if (translationProgress) {
      return `Translation complete: ${translationSegments.length} segments`;
    }
    if (translationEnabled) {
      return "Translation ready — loading...";
    }
    return "Translation disabled";
  };

  return (
    <div className="border-t border-border bg-surface p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Translation</h3>

      {/* Enable toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={translationEnabled}
          onChange={(e) => handleEnableToggle(e.target.checked)}
          className="rounded border-slate-300 text-accent w-3.5 h-3.5"
        />
        <span className="text-sm text-slate-600">
          {translationBilingual ? "Bilingual mode" : "Show translation"}
        </span>
      </label>

      {/* Target language */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Target Language
        </label>
        <select
          value={translationTargetLanguage}
          onChange={(e) => setTranslationTargetLanguage(e.target.value)}
          className="w-full h-8 px-2 text-xs rounded-md border border-border bg-surface focus:border-accent focus:outline-none"
        >
          {languages.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Bilingual toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={translationBilingual}
          onChange={(e) => setTranslationBilingual(e.target.checked)}
          className="rounded border-slate-300 text-accent w-3.5 h-3.5"
        />
        <span className="text-sm text-slate-600">Bilingual (show original + translation)</span>
      </label>

      {/* Concurrency slider */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Concurrency: {translationConcurrency}
        </label>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={translationConcurrency}
          onChange={(e) => setTranslationConcurrency(parseInt(e.target.value))}
          className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-accent"
        />
        <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
          <span>1 (slow)</span>
          <span>5 (fast)</span>
        </div>
      </div>

      {/* Prompt strategy */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Prompt Strategy
        </label>
        <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5">
          <button
            onClick={() => setTranslationPromptStrategy("standard")}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
              translationPromptStrategy === "standard"
                ? "bg-surface text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Standard
          </button>
          <button
            onClick={() => setTranslationPromptStrategy("hy_mt_optimized")}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
              translationPromptStrategy === "hy_mt_optimized"
                ? "bg-surface text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            HY-MT Opt
          </button>
        </div>
      </div>

      {/* Resume button */}
      <div>
        <Button variant="secondary" size="sm" onClick={handleResume}>
          Resume from checkpoint
        </Button>
      </div>

      {/* Status */}
      <div className="text-xs text-slate-400 pt-1 border-t border-border/50">
        {getStatusText()}
      </div>
    </div>
  );
};

export default ReaderTranslationPanel;

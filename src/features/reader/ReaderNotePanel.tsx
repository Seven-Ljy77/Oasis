import React, { useState, useCallback, useEffect, useRef } from "react";
import { useEntryStore } from "@/stores/useEntryStore";
import { useI18n } from "@/lib/i18n";
import { useResizableHeight } from "@/hooks/useResizableHeight";
import { getNote, saveNote } from "@/lib/ipc";
import {
  enqueueNoteSave,
  LatestValueSaveQueue,
  registerNoteDraftFlusher,
} from "@/lib/noteDraft";

export interface ReaderNotePanelProps {
  /** Called when the panel is closed */
  onClose?: () => void;
  className?: string;
  /** Maximum character count */
  maxLength?: number;
  /** Reports whether the current entry has a persisted non-empty note. */
  onNoteStateChange?: (entryId: number, hasNote: boolean) => void;
}

const ReaderNotePanel: React.FC<ReaderNotePanelProps> = ({
  onClose,
  maxLength = 10000,
  className = "",
  onNoteStateChange,
}) => {
  const { t } = useI18n();
  const { panelRef, dragHandle } = useResizableHeight("note", 200);
  const selectedEntryId = useEntryStore((s) => s.selectedEntryId);
  const [text, setText] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [localOpen, setLocalOpen] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef("");
  const entryIdRef = useRef<number | null>(selectedEntryId);
  const editVersionRef = useRef(0);
  const saveStateRef = useRef(new LatestValueSaveQueue(""));
  const mountedRef = useRef(true);

  const persistNote = useCallback(
    (entryId: number, value: string): Promise<void> => {
      const save = saveStateRef.current.save(value, (nextValue) =>
        enqueueNoteSave(entryId, () => saveNote(entryId, nextValue)),
      );
      if (
        save.enqueued &&
        mountedRef.current &&
        entryIdRef.current === entryId
      ) {
        setSaveStatus("saving");
      }

      return save.promise
        .then(() => {
          if (entryIdRef.current !== entryId) return;
          if (textRef.current === value) {
            onNoteStateChange?.(entryId, value.trim().length > 0);
            if (mountedRef.current) {
              setSaveStatus("saved");
            }
          }
        })
        .catch((error) => {
          if (
            mountedRef.current &&
            entryIdRef.current === entryId &&
            textRef.current === value
          ) {
            setSaveStatus("error");
          }
          throw error;
        });
    },
    [onNoteStateChange],
  );

  const flushSave = useCallback((): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const entryId = entryIdRef.current;
    const value = textRef.current;
    if (!entryId) return Promise.resolve();
    return persistNote(entryId, value);
  }, [persistNote]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load note when panel opens or entry changes
  useEffect(() => {
    entryIdRef.current = selectedEntryId;
    editVersionRef.current = 0;
    textRef.current = "";
    saveStateRef.current = new LatestValueSaveQueue("");
    setText("");
    setSaveStatus("idle");
    if (!selectedEntryId) return;

    const entryId = selectedEntryId;
    let cancelled = false;
    void getNote(entryId)
      .then((note) => {
        if (
          cancelled ||
          entryIdRef.current !== entryId ||
          editVersionRef.current !== 0
        ) {
          return;
        }
        const content = note?.text ?? "";
        textRef.current = content;
        setText(content);
        saveStateRef.current.reset(content);
        onNoteStateChange?.(entryId, content.trim().length > 0);
      })
      .catch(() => {
        if (!cancelled && entryIdRef.current === entryId) {
          setSaveStatus("error");
        }
      });

    return () => {
      cancelled = true;
      void flushSave().catch(() => undefined);
    };
  }, [selectedEntryId, flushSave, onNoteStateChange]);

  // 5-second auto-save debounce
  const scheduleSave = useCallback((value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const entryId = entryIdRef.current;
    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      if (!entryId) return;
      await persistNote(entryId, value).catch(() => undefined);
    }, 5000);
  }, [persistNote]);

  // Expose flushSave so parent can force-save before export / share.
  useEffect(() => {
    if (!selectedEntryId) return;
    return registerNoteDraftFlusher(selectedEntryId, flushSave);
  }, [selectedEntryId, flushSave]);

  // Save when the window loses focus (user switches apps) or before unload.
  useEffect(() => {
    const onBlur = () => {
      void flushSave().catch(() => undefined);
    };
    const onBeforeUnload = () => {
      void flushSave().catch(() => undefined);
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [flushSave]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= maxLength) {
        textRef.current = value;
        editVersionRef.current += 1;
        setText(value);
        scheduleSave(value);
        if (saveStatus !== "idle") setSaveStatus("idle");
      }
    },
    [scheduleSave, maxLength, saveStatus],
  );

  const handleSave = async () => {
    await flushSave().catch(() => undefined);
  };

  const saveStatusLabel = {
    idle: t.note.idle || "Auto-save in 5s",
    saving: t.note.saving,
    saved: t.note.saved,
    error: "Save error",
  }[saveStatus];

  const saveStatusColor = {
    idle: "text-slate-400",
    saving: "text-amber-500",
    saved: "text-emerald-500",
    error: "text-red-500",
  }[saveStatus];

  // Collapsed toggle bar
  if (!localOpen) {
    return (
      <button
        onClick={() => setLocalOpen(true)}
        className="h-10 border-t border-border bg-surface-secondary flex items-center gap-2 px-3 text-sm text-slate-500 hover:text-slate-700 hover:bg-surface-tertiary transition-colors w-full"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
        <span>{t.note.title}</span>
        {text && <span className="w-2 h-2 rounded-full bg-accent ml-auto" />}
      </button>
    );
  }

  return (
    <div
      data-component="ReaderNotePanel"
      ref={panelRef as any}
      className={`border-t border-border bg-surface flex flex-col ${className}`}
      style={{ maxHeight: "40vh" }}
    >
      {dragHandle}
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-secondary">
        <button onClick={() => setLocalOpen(false)} className="p-0.5 rounded hover:bg-surface-tertiary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-700">{t.note.title}</h3>

        <div className="flex-1" />

        <span className="text-[11px] text-slate-400 tabular-nums">
          {text.length} / {maxLength}
        </span>

        <span className={`text-[11px] font-medium ${saveStatusColor}`}>
          {saveStatusLabel}
        </span>

        <button
          onClick={handleSave}
          disabled={saveStatus === "saving"}
          className="px-2 py-0.5 text-xs font-medium rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {t.note.save}
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden p-3">
        <textarea
          value={text}
          onChange={handleChange}
          placeholder={t.note.placeholder}
          className="w-full h-full min-h-[120px] resize-none bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none leading-relaxed"
        />
      </div>

      <div className="px-3 py-1.5 border-t border-border/50 bg-surface-secondary text-[10px] text-slate-400">
        {t.note.characters}
      </div>
    </div>
  );
};

export default ReaderNotePanel;

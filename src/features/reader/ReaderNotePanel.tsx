// =============================================================================
// Mercury — ReaderNotePanel (markdown editor for article notes)
// =============================================================================

import React, { useState, useCallback } from "react";

export interface ReaderNotePanelProps {
  /** Initial markdown text */
  initialText?: string;
  /** Called when note text changes */
  onChange?: (text: string) => void;
  /** Called when save is requested */
  onSave?: (text: string) => void;
  /** Save status indicator */
  saveStatus?: "idle" | "saving" | "saved" | "error";
  /** Called when the panel is closed */
  onClose?: () => void;
  /** Whether the panel is visible */
  open?: boolean;
  /** Maximum character count */
  maxLength?: number;
  className?: string;
}

const ReaderNotePanel: React.FC<ReaderNotePanelProps> = ({
  initialText = "",
  onChange,
  onSave,
  saveStatus = "idle",
  onClose,
  open: propOpen,
  maxLength = 10000,
  className = "",
}) => {
  const [localOpen, setLocalOpen] = useState(true); // start expanded
  const open = propOpen ?? localOpen;
  const [text, setText] = useState(initialText);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length <= maxLength) {
        setText(value);
        onChange?.(value);
      }
    },
    [onChange, maxLength],
  );

  const handleSave = () => {
    onSave?.(text);
  };

  // TODO: implement debounced auto-save
  // TODO: implement markdown preview toggle

  const saveStatusLabel = {
    idle: "Ready",
    saving: "Saving...",
    saved: "Saved",
    error: "Save error",
  }[saveStatus];

  const saveStatusColor = {
    idle: "text-slate-400",
    saving: "text-amber-500",
    saved: "text-emerald-500",
    error: "text-red-500",
  }[saveStatus];

  // Collapsed toggle bar
  if (!open) {
    return (
      <button
        onClick={() => { setLocalOpen(true); }}
        className="h-10 border-t border-border bg-surface-secondary flex items-center gap-2 px-3 text-sm text-slate-500 hover:text-slate-700 hover:bg-surface-tertiary transition-colors w-full"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
        <span>Article Note</span>
        {text && <span className="w-2 h-2 rounded-full bg-accent ml-auto" />}
      </button>
    );
  }

  return (
    <div
      data-component="ReaderNotePanel"
      className={`border-t border-border bg-surface flex flex-col ${className}`}
      style={{ maxHeight: "40vh" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-secondary">
        <button onClick={() => { setLocalOpen(false); onClose?.(); }} className="p-0.5 rounded hover:bg-surface-tertiary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-700">Article Note</h3>

        <div className="flex-1" />

        {/* Character count */}
        <span className="text-[11px] text-slate-400 tabular-nums">
          {text.length} / {maxLength}
        </span>

        {/* Save status */}
        <span className={`text-[11px] font-medium ${saveStatusColor}`}>
          {saveStatusLabel}
        </span>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saveStatus === "saving"}
          className="px-2 py-0.5 text-xs font-medium rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          Save
        </button>

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary transition-colors"
            aria-label="Close note panel"
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
          placeholder="Write your notes in Markdown..."
          className="w-full h-full min-h-[120px] resize-none bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none leading-relaxed"
          aria-label="Article note text"
        />
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-border/50 bg-surface-secondary text-[10px] text-slate-400">
        Supports Markdown formatting
      </div>
    </div>
  );
};

export default ReaderNotePanel;

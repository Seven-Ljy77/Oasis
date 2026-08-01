import React, { useState } from "react";
import type { EntryListItem } from "@/lib/types";
import { relativeTime, truncate, stripHtml } from "@/lib/format";

interface EntryRowProps {
  entry: EntryListItem;
  isSelected: boolean;
  isMultiSelected: boolean;
  multiSelectMode: boolean;
  onClick: () => void;
  onStar: () => void;
}

const EntryRow: React.FC<EntryRowProps> = ({
  entry,
  isSelected,
  isMultiSelected,
  multiSelectMode,
  onClick,
  onStar,
}) => {
  const [hovered, setHovered] = useState(false);
  const showStar = hovered || entry.is_starred;

  const title = entry.title || "(Untitled)";
  const summaryText = entry.summary ? truncate(stripHtml(entry.summary), 120) : "";
  const timeLabel = relativeTime(entry.published_at);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer border-b border-border/50 transition-colors ${
        isSelected
          ? "bg-accent-muted"
          : isMultiSelected
            ? "bg-blue-50/60"
            : hovered
              ? "bg-surface-secondary"
              : "bg-surface"
      }`}
    >
      {/* Multi-select checkbox */}
      {multiSelectMode && (
        <div
          className={`w-5 h-5 mt-0.5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
            isMultiSelected
              ? "bg-accent border-accent"
              : "border-slate-300"
          }`}
        >
          {isMultiSelected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}

      {/* Unread indicator dot */}
      <div className="flex-shrink-0 mt-1.5">
        <div
          className={`w-[6px] h-[6px] rounded-full ${
            entry.is_read ? "bg-transparent" : "bg-accent"
          }`}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <h3
            className={`text-sm leading-snug line-clamp-2 ${
              entry.is_read ? "text-slate-500 font-normal" : "text-slate-900 font-semibold"
            }`}
          >
            {title}
          </h3>

          {/* Star button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStar();
            }}
            className={`flex-shrink-0 mt-0.5 transition-all ${
              showStar ? "opacity-100" : "opacity-0"
            }`}
            title={entry.is_starred ? "Unstar" : "Star"}
          >
            <svg
              className={`w-4 h-4 ${
                entry.is_starred
                  ? "text-amber-400 fill-amber-400"
                  : "text-slate-300 hover:text-amber-400"
              }`}
              fill={entry.is_starred ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </button>
        </div>

        {/* Feed source + date */}
        <div className="flex items-center gap-2 mt-0.5">
          {entry.feed_title && (
            <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
              {entry.feed_title}
            </span>
          )}
          {timeLabel && (
            <span className="text-[11px] text-slate-400 flex-shrink-0">{timeLabel}</span>
          )}
        </div>

        {/* Summary snippet */}
        {summaryText && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {summaryText}
          </p>
        )}
      </div>
    </div>
  );
};

export default EntryRow;

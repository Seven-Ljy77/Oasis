import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useEntryStore } from "@/stores/useEntryStore";
import { useI18n } from "@/lib/i18n";
import { searchEntries } from "@/lib/ipc";
import type { EntryListItem } from "@/lib/types";

const SearchModal: React.FC = () => {
  const { t } = useI18n();
  const searchOpen = useAppStore((s) => s.searchOpen);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const setSearchText = useAppStore((s) => s.setSearchText);
  const selectEntry = useEntryStore((s) => s.selectEntry);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntryListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (searchOpen) {
      setQuery("");
      setResults([]);
      setActiveIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setActiveIndex(-1);
      setSearchText("");
      return;
    }
    setSearchText(query.trim());
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchEntries(query.trim(), "TitleAndSummary");
        setResults(res);
        setActiveIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const close = useCallback(() => {
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
    setSearchText("");
    setSearchOpen(false);
  }, [setSearchOpen, setSearchText]);

  const handleSelect = useCallback(
    (entry: EntryListItem) => {
      selectEntry(entry.id);
      close();
    },
    [selectEntry, close],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < results.length) {
      handleSelect(results[activeIndex]);
    }
  };

  if (!searchOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 pb-16 px-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[3px]" onClick={close} />

      {/* Panel — tall rectangle */}
      <div
        className="relative w-full max-w-2xl bg-white border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "calc(100vh - 8rem)" }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entries by title or summary..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 placeholder-slate-400"
          />
          {loading && (
            <svg className="animate-spin w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <button
            onClick={close}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded border border-border flex-shrink-0"
          >
            Esc
          </button>
        </div>

        {/* Results — fills remaining height */}
        <div className="flex-1 overflow-y-auto">
          {!query.trim() && (
            <p className="px-5 py-12 text-sm text-slate-400 text-center">
              Type to search entries by title or summary...
            </p>
          )}
          {query.trim() && !loading && results.length === 0 && (
            <p className="px-5 py-12 text-sm text-slate-400 text-center">
              {t.common.noData}
            </p>
          )}
          {results.map((entry, idx) => (
            <button
              key={entry.id}
              onClick={() => handleSelect(entry)}
              className={`w-full text-left px-5 py-3 border-b border-border/50 hover:bg-surface-secondary transition-colors ${
                idx === activeIndex ? "bg-accent-muted" : ""
              }`}
            >
              <div className="text-sm text-slate-800 font-medium truncate">{entry.title || "Untitled"}</div>
              {entry.summary && (
                <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{entry.summary}</div>
              )}
              {entry.feed_title && (
                <div className="text-[10px] text-slate-400 mt-1">{entry.feed_title}</div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;

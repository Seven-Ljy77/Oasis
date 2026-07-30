import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useEntryStore } from "@/stores/useEntryStore";
import { useI18n } from "@/lib/i18n";
import { searchCategorized, type CategorizedSearchResults } from "@/lib/ipc";
import type { EntryListItem } from "@/lib/types";

type CategoryKey = keyof CategorizedSearchResults;

interface Category {
  key: CategoryKey;
  label: string;
  icon: string;
  color: string;
}

const CATEGORIES: Category[] = [
  { key: "by_content", label: "Articles", icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z", color: "text-amber-500" },
  { key: "by_tag", label: "Tags", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z", color: "text-purple-500" },
  { key: "by_note", label: "Notes", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", color: "text-blue-500" },
];

const SearchModal: React.FC = () => {
  const { t } = useI18n();
  const searchOpen = useAppStore((s) => s.searchOpen);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const setSearchText = useAppStore((s) => s.setSearchText);
  const selectEntry = useEntryStore((s) => s.selectEntry);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CategorizedSearchResults>({ by_content: [], by_tag: [], by_note: [] });
  const [loading, setLoading] = useState(false);
  const [activeCat, setActiveCat] = useState<CategoryKey>("by_content");
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (searchOpen) {
      setQuery("");
      setResults({ by_content: [], by_tag: [], by_note: [] });
      setActiveCat("by_content");
      setActiveIdx(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults({ by_content: [], by_tag: [], by_note: [] });
      setActiveCat("by_content");
      setActiveIdx(-1);
      setSearchText("");
      return;
    }
    setSearchText(trimmed);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchCategorized(trimmed);
        setResults(res);
        // Auto-select first non-empty category
        const firstNonEmpty = CATEGORIES.find((c) => res[c.key].length > 0);
        setActiveCat(firstNonEmpty?.key ?? "by_content");
        setActiveIdx(-1);
      } catch {
        setResults({ by_content: [], by_tag: [], by_note: [] });
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
    setResults({ by_content: [], by_tag: [], by_note: [] });
    setActiveCat("by_content");
    setActiveIdx(-1);
    setSearchText("");
    setSearchOpen(false);
  }, [setSearchOpen, setSearchText]);

  const handleSelect = useCallback((entry: EntryListItem) => {
    selectEntry(entry.id);
    close();
  }, [selectEntry, close]);

  const activeList = results[activeCat];
  const totalResults = CATEGORIES.reduce((sum, c) => sum + results[c.key].length, 0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((p) => Math.min(p + 1, activeList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((p) => Math.max(p - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0 && activeIdx < activeList.length) {
      handleSelect(activeList[activeIdx]);
    }
  };

  if (!searchOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-12 pb-12 px-4"
      role="dialog" aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[3px]" onClick={close} />

      {/* Outer panel */}
      <div
        className="relative w-full max-w-4xl bg-white border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "calc(100vh - 6rem)" }}
        onKeyDown={handleKeyDown}
      >
        {/* ---- Top search bar ---- */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles, tags, and notes..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 placeholder-slate-400"
          />
          {loading && (
            <svg className="animate-spin w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <span className="text-[10px] text-slate-400 flex-shrink-0">
            {query.trim() ? `${totalResults} results` : ""}
          </span>
          <button
            onClick={close}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded border border-border flex-shrink-0"
          >
            Esc
          </button>
        </div>

        {/* ---- Two-column body ---- */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar */}
          <div className="w-52 flex-shrink-0 border-r border-border bg-surface-secondary/50 flex flex-col">
            {CATEGORIES.map((cat) => {
              const count = results[cat.key].length;
              const isActive = activeCat === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => { setActiveCat(cat.key); setActiveIdx(-1); }}
                  disabled={count === 0}
                  className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors border-b border-border/30 ${
                    isActive
                      ? "bg-accent-muted text-accent font-medium border-r-2 border-r-accent"
                      : count > 0
                        ? "text-slate-700 hover:bg-surface-tertiary"
                        : "text-slate-300 cursor-default"
                  }`}
                >
                  <svg className={`w-4 h-4 flex-shrink-0 ${count > 0 ? cat.color : "text-slate-300"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cat.icon} />
                  </svg>
                  <span className="flex-1 text-left">{cat.label}</span>
                  {query.trim() && (
                    <span className={`text-xs ${isActive ? "text-accent" : "text-slate-400"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
            {/* Spacer to push items to top */}
            <div className="flex-1" />
          </div>

          {/* Right results panel */}
          <div className="flex-1 overflow-y-auto">
            {!query.trim() && (
              <p className="px-5 py-16 text-sm text-slate-400 text-center">
                Type to search articles, tags, and notes...
              </p>
            )}
            {query.trim() && !loading && totalResults === 0 && (
              <p className="px-5 py-16 text-sm text-slate-400 text-center">
                {t.common.noData}
              </p>
            )}
            {query.trim() && activeList.length > 0 && (
              <>
                {/* Right header */}
                <div className="flex items-center gap-2 px-5 py-2.5 bg-surface-secondary border-b border-border sticky top-0 z-10">
                  <svg className={`w-4 h-4 ${CATEGORIES.find((c) => c.key === activeCat)!.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={CATEGORIES.find((c) => c.key === activeCat)!.icon} />
                  </svg>
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    {CATEGORIES.find((c) => c.key === activeCat)!.label}
                  </span>
                  <span className="text-[10px] text-slate-400">{activeList.length} matches</span>
                </div>
                {/* Items */}
                {activeList.map((entry, idx) => (
                  <button
                    key={entry.id}
                    onClick={() => handleSelect(entry)}
                    className={`w-full text-left px-5 py-3 border-b border-border/30 hover:bg-surface-secondary transition-colors ${
                      idx === activeIdx ? "bg-accent-muted" : ""
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;

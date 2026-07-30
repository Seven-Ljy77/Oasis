import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useEntryStore } from "@/stores/useEntryStore";
import { useFeedStore } from "@/stores/useFeedStore";
import { useTagStore } from "@/stores/useTagStore";
import { useSidebarStore } from "@/stores/useSidebarStore";
import { useReaderStore } from "@/stores/useReaderStore";
import { useI18n } from "@/lib/i18n";
import { recalculateTagCounts, markAllRead } from "@/lib/ipc";
import EntryRow from "./EntryRow";
import MultiSelectToolbar from "./MultiSelectToolbar";
import Button from "@/components/ui/Button";
import type { EntryListItem } from "@/lib/types";

const EntryListView: React.FC = () => {
  const { t } = useI18n();
  const selectedFeedSelection = useAppStore((s) => s.selectedFeedSelection);
  const showUnreadOnly = useAppStore((s) => s.showUnreadOnly);
  const searchText = useAppStore((s) => s.searchText);
  const selectedTagIds = useAppStore((s) => s.selectedTagIds);
  const tagMatchMode = useAppStore((s) => s.tagMatchMode);
  const toggleUnreadOnly = useAppStore((s) => s.toggleUnreadOnly);
  const multiSelectMode = useAppStore((s) => s.multiSelectMode);
  const selectedEntryIds = useAppStore((s) => s.selectedEntryIds);
  const toggleSelectEntry = useAppStore((s) => s.toggleSelectEntry);
  const enterMultiSelect = useAppStore((s) => s.enterMultiSelect);
  const exitMultiSelect = useAppStore((s) => s.exitMultiSelect);
  const selectFeedGlobal = useAppStore((s) => s.selectFeed);

  const entries = useEntryStore((s) => s.entries);
  const isLoading = useEntryStore((s) => s.isLoading);
  const isLoadingMore = useEntryStore((s) => s.isLoadingMore);
  const hasMore = useEntryStore((s) => s.hasMore);
  const selectedEntryId = useEntryStore((s) => s.selectedEntryId);
  const selectEntry = useEntryStore((s) => s.selectEntry);
  const loadFirstPage = useEntryStore((s) => s.loadFirstPage);
  const loadNextPage = useEntryStore((s) => s.loadNextPage);
  const markRead = useEntryStore((s) => s.markRead);
  const markStarred = useEntryStore((s) => s.markStarred);
  const deleteEntry = useEntryStore((s) => s.deleteEntry);
  const clearEntries = useEntryStore((s) => s.clearEntries);

  // Load entries when filter changes
  useEffect(() => {
    const feedId =
      selectedFeedSelection.type === "feed"
        ? selectedFeedSelection.feedId
        : undefined;

    // TODO: debounce search text changes
    loadFirstPage({
      feed_id: feedId,
      unread_only: showUnreadOnly,
      starred_only: selectedFeedSelection.type === "starred" ? true : undefined,
      tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      tag_match_mode: tagMatchMode,
      search_text: searchText || undefined,
      limit: 50,
    });
  }, [selectedFeedSelection, showUnreadOnly, selectedTagIds, tagMatchMode, searchText]);

  // Infinite scroll with IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadNextPage]);

  // More actions dropdown state
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [moreMenuPinned, setMoreMenuPinned] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMoreMouseEnter = () => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    setMoreMenuOpen(true);
  };

  const handleMoreMouseLeave = () => {
    if (moreMenuPinned) return;
    hideTimerRef.current = setTimeout(() => setMoreMenuOpen(false), 250);
  };

  const handleMoreClick = () => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    if (moreMenuPinned) {
      setMoreMenuPinned(false);
      setMoreMenuOpen(false);
    } else {
      setMoreMenuPinned(true);
      setMoreMenuOpen(true);
    }
  };

  // Close dropdown on outside click (unpins too)
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
        setMoreMenuPinned(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreMenuOpen]);

  const handleEntryClick = (entry: EntryListItem) => {
    if (multiSelectMode) {
      toggleSelectEntry(entry.id);
    } else {
      selectEntry(entry.id);
    }
  };

  // Build query from current filters for query-scoped batch operations.
  const buildCurrentQuery = () => ({
    feed_id: selectedFeedSelection.type === "feed" ? selectedFeedSelection.feedId : undefined,
    unread_only: false, // Always target ALL entries in scope, not just unread
    starred_only: selectedFeedSelection.type === "starred" ? true : undefined,
    search_text: searchText || undefined,
    tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    tag_match_mode: tagMatchMode,
    limit: 1, // Not used for batch operations
  });

  const handleMarkAllRead = async () => {
    try {
      const query = buildCurrentQuery();
      await markAllRead(query, true);
      useSidebarStore.getState().loadCounts();
      loadFirstPage({ ...query, limit: 50 });
    } catch (err) {
      console.error("markAllRead failed:", err);
      alert("Mark All Read failed: " + String(err));
    }
  };

  const handleMarkAllUnread = async () => {
    try {
      const query = buildCurrentQuery();
      await markAllRead(query, false);
      useSidebarStore.getState().loadCounts();
      loadFirstPage({ ...query, limit: 50 });
    } catch (err) {
      console.error("markAllUnread failed:", err);
      alert("Mark All Unread failed: " + String(err));
    }
  };

  const deleteFeedFromStore = useFeedStore((s) => s.deleteFeed);
  const loadTags = useTagStore((s) => s.loadTags);

  const allFeeds = useFeedStore((s) => s.feeds);

  const handleDeleteSelected = async () => {
    if (!window.confirm("Delete ALL feeds and ALL articles? This cannot be undone.")) return;

    // Delete all feeds (cascades to entries)
    for (const feed of allFeeds) {
      await deleteFeedFromStore(feed.id);
    }

    // Recalculate tag counts and reload
    await recalculateTagCounts();
    await loadTags();
    useSidebarStore.getState().loadCounts();
    clearEntries();
    selectFeedGlobal({ type: "all" });
    loadFirstPage({
      feed_id: undefined,
      unread_only: showUnreadOnly,
      tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      tag_match_mode: tagMatchMode,
      search_text: searchText || undefined,
      limit: 50,
    });
  };

  const isStarredView = selectedFeedSelection.type === "starred";

  return (
    <div className="flex flex-col h-full">
      {/* ---- Multi-select toolbar ---- */}
      {multiSelectMode && <MultiSelectToolbar />}

      {/* ---- Header bar ---- */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-secondary">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">
            {isStarredView ? t.entryList.starred : t.entryList.entries}
          </h2>
          {isLoading && (
            <svg
              className="animate-spin w-3.5 h-3.5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Multi-select toggle */}
          <button
            onClick={() => multiSelectMode ? exitMultiSelect() : enterMultiSelect()}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              multiSelectMode
                ? "bg-accent-muted text-accent font-medium"
                : "text-slate-500 hover:text-slate-700"
            }`}
            title={multiSelectMode ? t.entryList.exitMultiSelect : t.entryList.multiSelect}
          >
            <svg className="w-3.5 h-3.5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {multiSelectMode ? t.entryList.exitMultiSelect : t.entryList.multiSelect}
          </button>

          {/* Unread-only toggle */}
          <button
            onClick={toggleUnreadOnly}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              showUnreadOnly
                ? "bg-accent-muted text-accent font-medium"
                : "text-slate-500 hover:text-slate-700"
            }`}
            title={t.entryList.unreadOnly}
          >
            {t.entryList.unreadOnly}
          </button>

          {/* Search toggle */}
          <button
            onClick={() => useAppStore.getState().setSearchOpen(true)}
            className="p-1 rounded hover:bg-surface-tertiary text-slate-400 hover:text-slate-600 transition-colors"
            title="Search (Ctrl+F)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Action menu */}
          <div
            className="relative"
            ref={moreMenuRef}
            onMouseEnter={handleMoreMouseEnter}
            onMouseLeave={handleMoreMouseLeave}
          >
            <button
              onClick={handleMoreClick}
              className="p-1 rounded hover:bg-surface-tertiary text-slate-400 hover:text-slate-600 transition-colors"
              title="More actions"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01"
                />
              </svg>
            </button>
            {moreMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-lg shadow-lg py-1 z-30">
                <button
                  onClick={() => { handleMarkAllRead(); setMoreMenuOpen(false); setMoreMenuPinned(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-surface-tertiary"
                >
                  {t.entryList.markAllRead}
                </button>
                <button
                  onClick={() => { handleMarkAllUnread(); setMoreMenuOpen(false); setMoreMenuPinned(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-surface-tertiary"
                >
                  {t.entryList.markAllUnread}
                </button>
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => { handleDeleteSelected(); setMoreMenuOpen(false); setMoreMenuPinned(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  {t.entryList.deleteAll}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Entry list ---- */}
      <div className="flex-1 overflow-y-auto">
        {!isLoading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <p className="text-sm">{t.entryList.noArticles}</p>
            <p className="text-xs mt-1">{t.entryList.selectFeedHint}</p>
          </div>
        )}
        {entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            isSelected={selectedEntryId === entry.id}
            isMultiSelected={selectedEntryIds.has(entry.id)}
            multiSelectMode={multiSelectMode}
            onClick={() => handleEntryClick(entry)}
            onStar={() => markStarred(entry.id, !entry.is_starred)}
          />
        ))}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="py-4 text-center">
          {isLoadingMore && (
            <span className="text-xs text-slate-400">{t.common.loading}</span>
          )}
          {!hasMore && entries.length > 0 && (
            <span className="text-xs text-slate-400">
              {entries.length} {t.entryList.entries}
            </span>
          )}
          {!hasMore && entries.length === 0 && !isLoading && (
            <span className="text-xs text-slate-400">{t.entryList.noArticles}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntryListView;

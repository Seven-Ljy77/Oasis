import React, { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useEntryStore } from "@/stores/useEntryStore";
import { useReaderStore } from "@/stores/useReaderStore";
import EntryRow from "./EntryRow";
import MultiSelectToolbar from "./MultiSelectToolbar";
import Button from "@/components/ui/Button";
import type { EntryListItem } from "@/lib/types";

const EntryListView: React.FC = () => {
  const selectedFeedSelection = useAppStore((s) => s.selectedFeedSelection);
  const showUnreadOnly = useAppStore((s) => s.showUnreadOnly);
  const searchText = useAppStore((s) => s.searchText);
  const selectedTagIds = useAppStore((s) => s.selectedTagIds);
  const tagMatchMode = useAppStore((s) => s.tagMatchMode);
  const toggleUnreadOnly = useAppStore((s) => s.toggleUnreadOnly);
  const multiSelectMode = useAppStore((s) => s.multiSelectMode);
  const selectedEntryIds = useAppStore((s) => s.selectedEntryIds);
  const toggleSelectEntry = useAppStore((s) => s.toggleSelectEntry);
  const openSheet = useAppStore((s) => s.openSheet);

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
  }, [selectedFeedSelection, showUnreadOnly, selectedTagIds, tagMatchMode]);

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

  const handleEntryClick = (entry: EntryListItem) => {
    if (multiSelectMode) {
      toggleSelectEntry(entry.id);
    } else {
      selectEntry(entry.id);
    }
  };

  const handleMarkAllRead = () => {
    const ids = entries.map((e) => e.id);
    markRead(ids, true);
  };

  const handleMarkAllUnread = () => {
    const ids = entries.map((e) => e.id);
    markRead(ids, false);
  };

  const handleDeleteSelected = () => {
    // TODO: batch delete
    console.log("Delete selected:", [...selectedEntryIds]);
  };

  const isStarredView = selectedFeedSelection.type === "starred";

  // Placeholder entries for UI rendering when empty
  const displayEntries: EntryListItem[] =
    entries.length > 0
      ? entries
      : [
          {
            id: 1,
            feed_id: 1,
            url: null,
              title: "Getting Started with Rust and Tauri",
            author: "Jane Doe",
            published_at: new Date(Date.now() - 3600000).toISOString(),
            summary: "A comprehensive guide to building desktop apps with Rust and Tauri 2.0.",
            is_read: false,
            is_starred: false,
            feed_title: "Example Blog",
            created_at: new Date().toISOString(),
          },
          {
            id: 2,
            feed_id: 1,
            url: null,
              title: "TypeScript 5.7 Released: What's New",
            author: null,
            published_at: new Date(Date.now() - 7200000).toISOString(),
            summary: "The latest TypeScript release brings improved type inference and new language features.",
            is_read: true,
            is_starred: true,
            feed_title: "Tech News Daily",
            created_at: new Date().toISOString(),
          },
          {
            id: 3,
            feed_id: 2,
            url: null,
              title: "Understanding React Server Components",
            author: "Alex Chen",
            published_at: new Date(Date.now() - 86400000).toISOString(),
            summary: "Deep dive into RSC architecture and how it changes the way we build React apps.",
            is_read: false,
            is_starred: false,
            feed_title: "Tech News Daily",
            created_at: new Date().toISOString(),
          },
        ];

  return (
    <div className="flex flex-col h-full">
      {/* ---- Multi-select toolbar ---- */}
      {multiSelectMode && <MultiSelectToolbar />}

      {/* ---- Header bar ---- */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-secondary">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">
            {isStarredView ? "Starred" : "Entries"}
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
          {/* Unread-only toggle */}
          <button
            onClick={toggleUnreadOnly}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              showUnreadOnly
                ? "bg-accent-muted text-accent font-medium"
                : "text-slate-500 hover:text-slate-700"
            }`}
            title="Show unread only"
          >
            Unread
          </button>

          {/* Action menu */}
          <div className="relative group">
            <button className="p-1 rounded hover:bg-surface-tertiary text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01"
                />
              </svg>
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-lg shadow-lg py-1 z-30 hidden group-hover:block">
              <button
                onClick={handleMarkAllRead}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-surface-tertiary"
              >
                Mark All Read
              </button>
              <button
                onClick={handleMarkAllUnread}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-surface-tertiary"
              >
                Mark All Unread
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={handleDeleteSelected}
                className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                Delete All
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => openSheet("exportMultipleDigest")}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-surface-tertiary"
              >
                Export Multiple Digest
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Entry list ---- */}
      <div className="flex-1 overflow-y-auto">
        {displayEntries.map((entry) => (
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
            <span className="text-xs text-slate-400">Loading more...</span>
          )}
          {!hasMore && entries.length > 0 && (
            <span className="text-xs text-slate-400">
              {entries.length} entries
            </span>
          )}
          {!hasMore && entries.length === 0 && !isLoading && (
            <span className="text-xs text-slate-400">No entries to show</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntryListView;

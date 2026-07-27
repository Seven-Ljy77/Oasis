import React, { useEffect, useRef, useState } from "react";
import { useSidebarStore } from "@/stores/useSidebarStore";
import { useAppStore, type SheetKind } from "@/stores/useAppStore";
import { useEntryListStore } from "@/stores/useEntryListStore";
import { useEntryStore } from "@/stores/useEntryStore";
import { useFeedStore } from "@/stores/useFeedStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useI18n } from "@/lib/i18n";
import { syncFeeds as ipcSyncFeeds } from "@/lib/ipc";
import { listen } from "@tauri-apps/api/event";
import ContextMenu, { type ContextMenuItem } from "@/components/ui/ContextMenu";
import * as dialog from "@tauri-apps/plugin-dialog";
import type { Feed } from "@/lib/types";

const FeedList: React.FC = () => {
  const { t } = useI18n();
  const feeds = useSidebarStore((s) => s.feeds);
  const totalUnread = useSidebarStore((s) => s.totalUnread);
  const starredCount = useSidebarStore((s) => s.starredCount);
  const starredUnread = useSidebarStore((s) => s.starredUnread);
  const selectedFeedId = useSidebarStore((s) => s.selectedFeedId);
  const selectFeed = useSidebarStore((s) => s.selectFeed);
  const feedsLoading = useSidebarStore((s) => s.feedsLoading);
  const setFeeds = useSidebarStore((s) => s.setFeeds);
  const setFeedsLoading = useSidebarStore((s) => s.setFeedsLoading);

  const openSheet = useAppStore((s) => s.openSheet);
  const selectFeedGlobal = useAppStore((s) => s.selectFeed);
  const selectedFeedSelectionType = useAppStore((s) => s.selectedFeedSelection.type);
  const setEntryLoading = useEntryListStore((s) => s.setLoading);
  const clearEntries = useEntryStore((s) => s.clearEntries);

  const feedStoreFeeds = useFeedStore((s) => s.feeds);
  const loadFeeds = useFeedStore((s) => s.loadFeeds);
  const deleteFeed = useFeedStore((s) => s.deleteFeed);
  const exportOpml = useFeedStore((s) => s.exportOpml);
  const loadCounts = useSidebarStore((s) => s.loadCounts);

  // More actions dropdown state
  const [syncing, setSyncing] = useState(false);
  const [syncingFeedIds, setSyncingFeedIds] = useState<Set<number>>(new Set());

  // Listen for sync progress events
  useEffect(() => {
    const unlisten = listen<{
      feed_id: number; status: string; completed: number; total: number;
    }>("sync-progress", (event) => {
      const { feed_id, status } = event.payload;
      setSyncingFeedIds((prev) => {
        const next = new Set(prev);
        if (status === "syncing") next.add(feed_id);
        else next.delete(feed_id);
        return next;
      });
      if (status === "done" || status === "error") {
        setSyncingFeedIds((prev) => {
          const next = new Set(prev);
          next.delete(feed_id);
          return next;
        });
      }
      // All done — reload feeds and counts
      if (event.payload.completed >= event.payload.total) {
        setSyncing(false);
        loadFeeds();
        loadCounts();
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [moreMenuPinned, setMoreMenuPinned] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show dropdown on hover (cancel any pending hide)
  const handleMouseEnter = () => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    setMoreMenuOpen(true);
  };
  // Hide on mouse leave unless pinned (with delay to let mouse reach the menu)
  const handleMouseLeave = () => {
    if (moreMenuPinned) return;
    hideTimerRef.current = setTimeout(() => setMoreMenuOpen(false), 250);
  };
  // Click toggles pin
  const handleClick = () => {
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

  const handleImportOpml = () => {
    setMoreMenuOpen(false);
    openSheet("importOPML" as SheetKind);
  };

  const handleExportOpml = async () => {
    setMoreMenuOpen(false);
    const filePath = await dialog.save({
      filters: [{ name: "OPML Files", extensions: ["opml"] }],
      defaultPath: "oasis-subscriptions.opml",
    });
    if (filePath) {
      await exportOpml(filePath);
    }
  };

  // Load feeds from backend on mount
  useEffect(() => {
    setFeedsLoading(true);
    loadFeeds().finally(() => setFeedsLoading(false));
  }, []);

  // Sync feed store data into sidebar store
  useEffect(() => {
    setFeeds(feedStoreFeeds);
  }, [feedStoreFeeds]);

  const handleSelectAllFeeds = () => {
    selectFeed(null);
    selectFeedGlobal({ type: "all" });
  };

  const handleSelectStarred = () => {
    selectFeed(null);
    selectFeedGlobal({ type: "starred" });
  };

  const handleSelectFeed = (feed: Feed) => {
    selectFeed(feed.id);
    selectFeedGlobal({ type: "feed", feedId: feed.id });
  };

  const getFeedContextMenu = (feed: Feed): ContextMenuItem[] => [
    {
      label: t.sidebar.editFeed,
      onClick: () => {
        openSheet("feedEditor" as SheetKind);
      },
    },
    {
      label: t.sidebar.deleteFeed,
      danger: true,
      onClick: async () => {
        if (window.confirm(`Delete "${feed.title || feed.feed_url}"? This will remove all associated entries.`)) {
          await deleteFeed(feed.id);
          clearEntries();
          selectFeedGlobal({ type: "all" });
        }
      },
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* ---- Header with + and ... buttons ---- */}
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {t.sidebar.feeds}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={async () => {
              if (syncing) return;
              setSyncing(true);
              try {
                const concurrency = useSettingsStore.getState().settings.sync_concurrency ?? 6;
                await ipcSyncFeeds(concurrency);
                loadFeeds();
              } finally {
                setSyncing(false);
              }
            }}
            className={`p-1 rounded transition-colors ${syncing ? "text-accent animate-spin" : "text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary"}`}
            title={t.sidebar.syncAll}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => openSheet("feedEditor" as SheetKind)}
            className="p-1 rounded hover:bg-surface-tertiary text-slate-400 hover:text-slate-600 transition-colors"
            title={t.sidebar.addFeed}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={() => openSheet("appSettings" as SheetKind)}
            className="p-1 rounded hover:bg-surface-tertiary text-slate-400 hover:text-slate-600 transition-colors"
            title={t.sidebar.settings}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <div
            className="relative"
            ref={moreMenuRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={handleClick}
              className="p-1 rounded hover:bg-surface-tertiary text-slate-400 hover:text-slate-600 transition-colors"
              title="More actions"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>
            {moreMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-border bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={handleImportOpml}
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-surface-tertiary transition-colors cursor-pointer"
                >
                  {t.sidebar.importOpml}
                </button>
                <button
                  type="button"
                  onClick={handleExportOpml}
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-surface-tertiary transition-colors cursor-pointer"
                >
                  {t.sidebar.exportOpml}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Feed list ---- */}
      <div className="flex-1 overflow-y-auto px-1">
        {feedsLoading && (
          <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
            {t.common.loading}
          </div>
        )}

        {/* "All Feeds" row */}
        <button
          onClick={handleSelectAllFeeds}
          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
            selectedFeedSelectionType === "all"
              ? "bg-accent-muted text-accent font-medium"
              : "text-slate-700 hover:bg-surface-tertiary"
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="flex-1 text-left truncate">{t.sidebar.allFeeds}</span>
          {totalUnread > 0 && (
            <span className="text-xs bg-accent text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-medium">
              {totalUnread > 999 ? "999+" : totalUnread}
            </span>
          )}
        </button>

        {/* "Starred" row */}
        <button
          onClick={handleSelectStarred}
          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
            selectedFeedSelectionType === "starred"
              ? "bg-accent-muted text-accent font-medium"
              : "text-slate-700 hover:bg-surface-tertiary"
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <span className="flex-1 text-left truncate">{t.sidebar.starred}</span>
          {starredCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-medium">
              {starredCount > 999 ? "999+" : starredCount}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="mx-3 my-2 border-t border-border" />

        {/* Feed rows */}
        {!feedsLoading && feeds.length > 0 && feeds.map((feed) => (
          <ContextMenu key={feed.id} items={getFeedContextMenu(feed)}>
            <button
              onClick={() => handleSelectFeed(feed)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                selectedFeedId === feed.id
                  ? "bg-accent-muted text-accent font-medium"
                  : "text-slate-700 hover:bg-surface-tertiary"
              }`}
            >
              {syncingFeedIds.has(feed.id) ? (
                <div className="w-4 h-4 rounded bg-accent flex-shrink-0 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              ) : (
                <div className="w-4 h-4 rounded bg-slate-300 flex-shrink-0 flex items-center justify-center text-[8px] text-white font-bold">
                  {feed.title?.[0] ?? "?"}
                </div>
              )}
              <span className="flex-1 text-left truncate">{feed.title}</span>
              {(feed.unread_count ?? 0) > 0 && (
                <span className="text-xs text-slate-400 font-medium">
                  {(feed.unread_count ?? 0) > 999 ? "999+" : feed.unread_count}
                </span>
              )}
            </button>
          </ContextMenu>
        ))}

        {/* Empty state */}
        {!feedsLoading && feeds.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-slate-400">
            <p>{t.common.noData}</p>
            <p className="text-xs mt-1">{t.sidebar.addFeed}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedList;

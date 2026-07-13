import React, { useEffect } from "react";
import { useSidebarStore } from "@/stores/useSidebarStore";
import { useAppStore, type SheetKind } from "@/stores/useAppStore";
import { useEntryListStore } from "@/stores/useEntryListStore";
import ContextMenu, { type ContextMenuItem } from "@/components/ui/ContextMenu";
import type { Feed } from "@/lib/types";
// TODO: import { getFeeds, syncFeeds, exportOpml, deleteFeed } from "@/lib/ipc";

const FeedList: React.FC = () => {
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
  const setEntryLoading = useEntryListStore((s) => s.setLoading);

  // TODO: Load feeds from backend on mount
  useEffect(() => {
    // Placeholder: load feeds
    // setFeedsLoading(true);
    // getFeeds().then(setFeeds).finally(() => setFeedsLoading(false));
  }, []);

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
      label: "Edit",
      onClick: () => {
        // TODO: store feed-to-edit in state, then open editor sheet
        openSheet("feedEditor" as SheetKind);
      },
    },
    {
      label: "Delete",
      danger: true,
      onClick: () => {
        // TODO: confirm dialog, then deleteFeed(feed.id)
      },
    },
  ];

  // Placeholder feeds for UI rendering
  const placeholderFeeds: Feed[] = feeds.length > 0 ? feeds : [
    { id: 1, title: "Example Blog", feed_url: "https://example.com/feed", site_url: "https://example.com", unread_count: 12, total_count: 45, last_synced_at: null, error_message: null, is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any,
    { id: 2, title: "Tech News Daily", feed_url: "https://technews.example/feed", site_url: "https://technews.example", unread_count: 3, total_count: 230, last_synced_at: null, error_message: null, is_enabled: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any,
  ];

  return (
    <div className="flex flex-col h-full">
      {/* ---- Header with + and ... buttons ---- */}
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Feeds
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => openSheet("feedEditor" as SheetKind)}
            className="p-1 rounded hover:bg-surface-tertiary text-slate-400 hover:text-slate-600 transition-colors"
            title="Add feed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            className="p-1 rounded hover:bg-surface-tertiary text-slate-400 hover:text-slate-600 transition-colors"
            title="More actions"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
            </svg>
          </button>
        </div>
      </div>

      {/* ---- Feed list ---- */}
      <div className="flex-1 overflow-y-auto px-1">
        {feedsLoading && (
          <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
            Loading feeds...
          </div>
        )}

        {/* "All Feeds" row */}
        <button
          onClick={handleSelectAllFeeds}
          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
            selectedFeedId === null
              ? "bg-accent-muted text-accent font-medium"
              : "text-slate-700 hover:bg-surface-tertiary"
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="flex-1 text-left truncate">All Feeds</span>
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
            false
              ? "bg-accent-muted text-accent font-medium"
              : "text-slate-700 hover:bg-surface-tertiary"
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <span className="flex-1 text-left truncate">Starred</span>
          {starredUnread > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-medium">
              {starredUnread > 999 ? "999+" : starredUnread}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="mx-3 my-2 border-t border-border" />

        {/* Placeholder feed rows */}
        {!feedsLoading && placeholderFeeds.map((feed) => (
          <ContextMenu key={feed.id} items={getFeedContextMenu(feed)}>
            <button
              onClick={() => handleSelectFeed(feed)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                selectedFeedId === feed.id
                  ? "bg-accent-muted text-accent font-medium"
                  : "text-slate-700 hover:bg-surface-tertiary"
              }`}
            >
              {/* Favicon placeholder */}
              <div className="w-4 h-4 rounded bg-slate-300 flex-shrink-0 flex items-center justify-center text-[8px] text-white font-bold">
                {feed.title?.[0] ?? "?"}
              </div>
              <span className="flex-1 text-left truncate">{feed.title}</span>
              {(feed as any).unread_count > 0 && (
                <span className="text-xs text-slate-400 font-medium">
                  {(feed as any).unread_count > 999 ? "999+" : (feed as any).unread_count}
                </span>
              )}
            </button>
          </ContextMenu>
        ))}
      </div>
    </div>
  );
};

export default FeedList;

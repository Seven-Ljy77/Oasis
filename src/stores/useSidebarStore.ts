import { create } from "zustand";
import type { Feed, TagInfo } from "@/lib/types";
import * as ipc from "@/lib/ipc";
import { useAppStore } from "./useAppStore";

interface SidebarState {
  // Feeds
  feeds: Feed[];
  totalUnread: number;
  starredCount: number;
  starredUnread: number;
  totalEntries: number;
  totalFeeds: number;
  selectedFeedId: number | null;
  feedsLoading: boolean;

  setFeeds: (feeds: Feed[]) => void;
  setFeedsLoading: (loading: boolean) => void;
  selectFeed: (id: number | null) => void;
  loadCounts: () => Promise<void>;

  // Tags
  tags: TagInfo[];
  selectedTagIds: Set<number>;
  tagMatchMode: "any" | "all";
  tagSearchText: string;

  setTags: (tags: TagInfo[]) => void;
  toggleTag: (id: number) => void;
  setTagMatchMode: (mode: "any" | "all") => void;
  setTagSearchText: (text: string) => void;
  clearTags: () => void;

  // Sync
  syncPhase: "idle" | "syncing" | "error";
  syncMessage: string | null;
  syncState: { phase: string; message?: string } | null;
  setSyncPhase: (phase: "idle" | "syncing" | "error", message?: string) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  feeds: [],
  totalUnread: 0,
  starredCount: 0,
  starredUnread: 0,
  totalEntries: 0,
  totalFeeds: 0,
  selectedFeedId: null,
  feedsLoading: false,
  syncState: null,

  setFeeds: (feeds) =>
    set({
      feeds,
      totalUnread: feeds.reduce((sum, f) => sum + (f.unread_count ?? 0), 0),
    }),
  setFeedsLoading: (loading) => set({ feedsLoading: loading }),
  selectFeed: (id) => set({ selectedFeedId: id }),

  loadCounts: async () => {
    try {
      const proj = await ipc.getSidebarProjection();
      console.log("[loadCounts] projection:", proj);
      set({
        totalUnread: proj.total_unread,
        starredCount: proj.total_starred,
        starredUnread: proj.starred_unread,
        totalEntries: proj.total_entries,
        totalFeeds: proj.total_feeds,
      });
      // Also update per-feed unread counts on the existing feeds list
      set((s) => {
        const countMap = new Map(proj.per_feed.map((fc) => [fc.feed_id, fc.unread]));
        return {
          feeds: s.feeds.map((f) => ({
            ...f,
            unread_count: countMap.get(f.id) ?? 0,
          })),
        };
      });
      // Sync to app store for StatusBar
      useAppStore.getState().setTotalUnread(proj.total_unread);
      useAppStore.getState().setFeedCount(proj.total_feeds);
      useAppStore.getState().setEntryCount(proj.total_entries);
    } catch (err) {
      console.error("[loadCounts] failed:", err);
    }
  },

  tags: [],
  selectedTagIds: new Set(),
  tagMatchMode: "any",
  tagSearchText: "",

  setTags: (tags) => set({ tags }),
  toggleTag: (id) =>
    set((s) => {
      const next = new Set(s.selectedTagIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedTagIds: next };
    }),
  setTagMatchMode: (tagMatchMode) => set({ tagMatchMode }),
  setTagSearchText: (tagSearchText) => set({ tagSearchText }),
  clearTags: () => set({ selectedTagIds: new Set() }),

  syncPhase: "idle",
  syncMessage: null,
  setSyncPhase: (phase, message) =>
    set({ syncPhase: phase, syncMessage: message ?? null, syncState: phase === "idle" ? null : { phase, message: message ?? "" } }),
}));

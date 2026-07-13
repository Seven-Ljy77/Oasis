// =============================================================================
// Mercury — Feed Store
// =============================================================================

import { create } from "zustand";
import type { Feed } from "@/lib/types";
import * as ipc from "@/lib/ipc";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface FeedState {
  feeds: Feed[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadFeeds: () => Promise<void>;
  addFeed: (url: string, title?: string) => Promise<Feed | null>;
  updateFeed: (id: number, url: string, title?: string) => Promise<Feed | null>;
  deleteFeed: (id: number) => Promise<void>;
  syncFeeds: (concurrency?: number) => Promise<void>;
  importOpml: (
    path: string,
    replace: boolean,
    forceSiteName: boolean,
  ) => Promise<void>;
  exportOpml: (path: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState = {
  feeds: [] as Feed[],
  isLoading: false,
  error: null as string | null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFeedStore = create<FeedState>()((set, get) => ({
  ...initialState,

  loadFeeds: async () => {
    set({ isLoading: true, error: null });
    try {
      // TODO: replace with actual ipc.getFeeds() call
      const feeds = await ipc.getFeeds();
      set({ feeds, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
    }
  },

  addFeed: async (url, title) => {
    // TODO: optimistic add + rollback on failure
    try {
      const feed = await ipc.addFeed(url, title);
      set((s) => ({ feeds: [...s.feeds, feed] }));
      return feed;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      return null;
    }
  },

  updateFeed: async (id, url, title) => {
    try {
      const updated = await ipc.updateFeed(id, url, title);
      set((s) => ({
        feeds: s.feeds.map((f) => (f.id === id ? updated : f)),
      }));
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      return null;
    }
  },

  deleteFeed: async (id) => {
    try {
      await ipc.deleteFeed(id);
      set((s) => ({ feeds: s.feeds.filter((f) => f.id !== id) }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  syncFeeds: async (concurrency) => {
    // TODO: integrate with appStore.setSyncState for progress
    try {
      await ipc.syncFeeds(concurrency);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  importOpml: async (path, replace, forceSiteName) => {
    // TODO: use @tauri-apps/plugin-dialog for file picker
    try {
      await ipc.importOpml(path, replace, forceSiteName);
      // Reload feeds after import
      await get().loadFeeds();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  exportOpml: async (path) => {
    // TODO: use @tauri-apps/plugin-dialog for save path
    try {
      await ipc.exportOpml(path);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },
}));

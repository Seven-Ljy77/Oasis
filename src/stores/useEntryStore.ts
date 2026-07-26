// =============================================================================
// Mercury — Entry Store
// =============================================================================

import { create } from "zustand";
import type {
  EntryListItem,
  EntryListQuery,
  PageCursor,
} from "@/lib/types";
import { useSidebarStore } from "./useSidebarStore";
import * as ipc from "@/lib/ipc";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface EntryState {
  entries: EntryListItem[];
  cursor: PageCursor | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;

  // Selection
  selectedEntryId: number | null;
  multiSelectIds: Set<number>;

  // Actions
  loadFirstPage: (query: EntryListQuery) => Promise<void>;
  loadNextPage: () => Promise<void>;
  markRead: (entryIds: number[], isRead: boolean) => Promise<void>;
  markStarred: (entryId: number, isStarred: boolean) => Promise<void>;
  deleteEntry: (entryId: number) => Promise<void>;
  selectEntry: (entryId: number | null) => void;
  toggleMultiSelect: (entryId: number) => void;
  clearMultiSelect: () => void;
  selectAllEntries: () => void;
  clearEntries: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState = {
  entries: [] as EntryListItem[],
  cursor: null as PageCursor | null,
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  error: null as string | null,
  selectedEntryId: null as number | null,
  multiSelectIds: new Set<number>(),
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useEntryStore = create<EntryState>()((set, get) => {
  // Internal: keep a reference to the last query for loadNextPage
  let lastQuery: EntryListQuery | null = null;

  return {
    ...initialState,

    loadFirstPage: async (query) => {
      lastQuery = query;
      set({ isLoading: true, error: null });

      try {
        const page = await ipc.loadEntries(query);
        set({
          entries: page.entries,
          cursor: page.next_cursor,
          hasMore: page.next_cursor !== null,
          isLoading: false,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({ error: message, isLoading: false });
      }
    },

    loadNextPage: async () => {
      const { cursor, isLoadingMore, isLoading } = get();
      if (!cursor || isLoadingMore || isLoading) return;

      set({ isLoadingMore: true });
      try {
        const page = await ipc.loadNextEntries(cursor);
        set((s) => ({
          entries: [...s.entries, ...page.entries],
          cursor: page.next_cursor,
          hasMore: page.next_cursor !== null,
          isLoadingMore: false,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({ error: message, isLoadingMore: false });
      }
    },

    markRead: async (entryIds, isRead) => {
      // Optimistic update
      set((s) => ({
        entries: s.entries.map((e) =>
          entryIds.includes(e.id) ? { ...e, is_read: isRead } : e,
        ),
      }));

      try {
        await ipc.markRead(entryIds, isRead);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({ error: message });
        // TODO: rollback optimistic update
      }
      useSidebarStore.getState().loadCounts();
    },

    markStarred: async (entryId, isStarred) => {
      // Optimistic update
      set((s) => ({
        entries: s.entries.map((e) =>
          e.id === entryId ? { ...e, is_starred: isStarred } : e,
        ),
      }));

      try {
        await ipc.markStarred(entryId, isStarred);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({ error: message });
        // TODO: rollback optimistic update
      }
      useSidebarStore.getState().loadCounts();
    },

    deleteEntry: async (entryId) => {
      // Optimistic removal
      set((s) => ({
        entries: s.entries.filter((e) => e.id !== entryId),
        selectedEntryId:
          s.selectedEntryId === entryId ? null : s.selectedEntryId,
        multiSelectIds: new Set(
          [...s.multiSelectIds].filter((id) => id !== entryId),
        ),
      }));

      try {
        await ipc.deleteEntry(entryId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({ error: message });
        // TODO: rollback optimistic removal by reloading page
      }
      useSidebarStore.getState().loadCounts();
    },

    selectEntry: (entryId) =>
      set((s) => {
        // Mark single selected entry as read automatically
        if (entryId !== null) {
          const entry = s.entries.find((e) => e.id === entryId);
          if (entry && !entry.is_read) {
            // Fire-and-forget; markRead handles optimistic state
            get().markRead([entryId], true);
          }
        }
        return { selectedEntryId: entryId };
      }),

    toggleMultiSelect: (entryId) =>
      set((s) => {
        const next = new Set(s.multiSelectIds);
        if (next.has(entryId)) {
          next.delete(entryId);
        } else {
          next.add(entryId);
        }
        return { multiSelectIds: next };
      }),

    clearMultiSelect: () =>
      set({ multiSelectIds: new Set() }),

    selectAllEntries: () =>
      set((s) => ({
        multiSelectIds: new Set(s.entries.map((e) => e.id)),
      })),

    clearEntries: () =>
      set({
        entries: [],
        cursor: null,
        hasMore: false,
        selectedEntryId: null,
        multiSelectIds: new Set(),
      }),
  };
});

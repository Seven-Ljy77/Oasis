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
  let queryVersion = 0;
  let mutationVersion = 0;
  let readMutationTail = Promise.resolve();
  let starredMutationTail = Promise.resolve();
  const readConfirmedValues = new Map<number, boolean>();
  const readLatestVersions = new Map<number, number>();
  const readPendingCounts = new Map<number, number>();
  const starredConfirmedValues = new Map<number, boolean>();
  const starredLatestVersions = new Map<number, number>();
  const starredPendingCounts = new Map<number, number>();

  return {
    ...initialState,

    loadFirstPage: async (query) => {
      const requestVersion = ++queryVersion;
      lastQuery = query;
      set({ isLoading: true, isLoadingMore: false, error: null });

      try {
        const page = await ipc.loadEntries(query);
        if (requestVersion !== queryVersion) return;
        set({
          entries: page.entries,
          cursor: page.next_cursor,
          hasMore: page.next_cursor !== null,
          isLoading: false,
        });
      } catch (err) {
        if (requestVersion !== queryVersion) return;
        const message = err instanceof Error ? err.message : String(err);
        set({ error: message, isLoading: false });
      }
    },

    loadNextPage: async () => {
      const requestVersion = queryVersion;
      const { cursor, isLoadingMore, isLoading } = get();
      if (!cursor || !lastQuery || isLoadingMore || isLoading) return;

      set({ isLoadingMore: true });
      try {
        const page = await ipc.loadNextEntries(lastQuery, cursor);
        if (requestVersion !== queryVersion) return;
        set((s) => ({
          entries: [...s.entries, ...page.entries],
          cursor: page.next_cursor,
          hasMore: page.next_cursor !== null,
          isLoadingMore: false,
        }));
      } catch (err) {
        if (requestVersion !== queryVersion) return;
        const message = err instanceof Error ? err.message : String(err);
        set({ error: message, isLoadingMore: false });
      }
    },

    markRead: async (entryIds, isRead) => {
      const requestVersion = queryVersion;
      const currentMutationVersion = ++mutationVersion;
      const currentEntries = get().entries;
      for (const entryId of entryIds) {
        const pendingCount = readPendingCounts.get(entryId) ?? 0;
        if (pendingCount === 0) {
          const current = currentEntries.find((entry) => entry.id === entryId);
          if (current) readConfirmedValues.set(entryId, current.is_read);
        }
        readPendingCounts.set(entryId, pendingCount + 1);
        readLatestVersions.set(entryId, currentMutationVersion);
      }
      // Optimistic update
      set((s) => ({
        error: null,
        entries: s.entries.map((e) =>
          entryIds.includes(e.id) ? { ...e, is_read: isRead } : e,
        ),
      }));

      const operation = readMutationTail
        .catch(() => undefined)
        .then(() => ipc.markRead(entryIds, isRead));
      readMutationTail = operation.catch(() => undefined);
      let failureMessage: string | null = null;
      try {
        await operation;
        for (const entryId of entryIds) {
          readConfirmedValues.set(entryId, isRead);
        }
        useSidebarStore.getState().loadCounts();
      } catch (err) {
        failureMessage = err instanceof Error ? err.message : String(err);
      } finally {
        if (requestVersion === queryVersion) {
          const isLatest = entryIds.some(
            (entryId) =>
              readLatestVersions.get(entryId) === currentMutationVersion,
          );
          set((state) => ({
            error: failureMessage && isLatest ? failureMessage : state.error,
            entries: state.entries.map((entry) =>
              readLatestVersions.get(entry.id) === currentMutationVersion &&
              readConfirmedValues.has(entry.id)
                ? { ...entry, is_read: readConfirmedValues.get(entry.id)! }
                : entry,
            ),
          }));
        }
        for (const entryId of entryIds) {
          const remaining = (readPendingCounts.get(entryId) ?? 1) - 1;
          if (remaining === 0) {
            readPendingCounts.delete(entryId);
            readConfirmedValues.delete(entryId);
            readLatestVersions.delete(entryId);
          } else {
            readPendingCounts.set(entryId, remaining);
          }
        }
      }
    },

    markStarred: async (entryId, isStarred) => {
      const requestVersion = queryVersion;
      const currentMutationVersion = ++mutationVersion;
      const current = get().entries.find(
        (entry) => entry.id === entryId,
      );
      const pendingCount = starredPendingCounts.get(entryId) ?? 0;
      if (pendingCount === 0 && current) {
        starredConfirmedValues.set(entryId, current.is_starred);
      }
      starredPendingCounts.set(entryId, pendingCount + 1);
      starredLatestVersions.set(entryId, currentMutationVersion);
      // Optimistic update
      set((s) => ({
        error: null,
        entries: s.entries.map((e) =>
          e.id === entryId ? { ...e, is_starred: isStarred } : e,
        ),
      }));

      const operation = starredMutationTail
        .catch(() => undefined)
        .then(() => ipc.markStarred(entryId, isStarred));
      starredMutationTail = operation.catch(() => undefined);
      let failureMessage: string | null = null;
      try {
        await operation;
        starredConfirmedValues.set(entryId, isStarred);
        useSidebarStore.getState().loadCounts();
      } catch (err) {
        failureMessage = err instanceof Error ? err.message : String(err);
      } finally {
        if (requestVersion === queryVersion) {
          const isLatest =
            starredLatestVersions.get(entryId) === currentMutationVersion;
          set((state) => ({
            error: failureMessage && isLatest ? failureMessage : state.error,
            entries: state.entries.map((entry) =>
              entry.id === entryId &&
              isLatest &&
              starredConfirmedValues.has(entryId)
                ? {
                    ...entry,
                    is_starred: starredConfirmedValues.get(entryId)!,
                  }
                : entry,
            ),
          }));
        }
        const remaining = (starredPendingCounts.get(entryId) ?? 1) - 1;
        if (remaining === 0) {
          starredPendingCounts.delete(entryId);
          starredConfirmedValues.delete(entryId);
          starredLatestVersions.delete(entryId);
        } else {
          starredPendingCounts.set(entryId, remaining);
        }
      }
    },

    deleteEntry: async (entryId) => {
      const requestVersion = queryVersion;
      const before = get();
      const removedIndex = before.entries.findIndex(
        (entry) => entry.id === entryId,
      );
      const removedEntry = before.entries[removedIndex];
      const wasSelected = before.selectedEntryId === entryId;
      const wasMultiSelected = before.multiSelectIds.has(entryId);
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
        useSidebarStore.getState().loadCounts();
      } catch (err) {
        if (requestVersion !== queryVersion) return;
        const message = err instanceof Error ? err.message : String(err);
        set((state) => {
          const entries = [...state.entries];
          if (
            removedEntry &&
            !entries.some((entry) => entry.id === entryId)
          ) {
            entries.splice(Math.min(removedIndex, entries.length), 0, removedEntry);
          }
          const multiSelectIds = new Set(state.multiSelectIds);
          if (wasMultiSelected) {
            multiSelectIds.add(entryId);
          }
          return {
            error: message,
            entries,
            selectedEntryId:
              wasSelected && state.selectedEntryId === null
                ? entryId
                : state.selectedEntryId,
            multiSelectIds,
          };
        });
      }
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

    clearEntries: () => {
      queryVersion += 1;
      lastQuery = null;
      set({
        entries: [],
        cursor: null,
        hasMore: false,
        isLoading: false,
        isLoadingMore: false,
        selectedEntryId: null,
        multiSelectIds: new Set(),
      });
    },
  };
});

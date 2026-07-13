import { create } from "zustand";
import type { EntryListItem } from "@/lib/types";

interface EntryListState {
  entries: EntryListItem[];
  totalCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  unreadOnly: boolean;
  activeEntryId: number | null;

  setEntries: (entries: EntryListItem[], total: number, hasMore: boolean) => void;
  appendEntries: (entries: EntryListItem[], hasMore: boolean) => void;
  setLoading: (loading: boolean) => void;
  setLoadingMore: (loading: boolean) => void;
  setUnreadOnly: (unreadOnly: boolean) => void;
  setActiveEntry: (id: number | null) => void;
  updateEntry: (id: number, updates: Partial<EntryListItem>) => void;
  removeEntries: (ids: number[]) => void;
}

export const useEntryListStore = create<EntryListState>((set) => ({
  entries: [],
  totalCount: 0,
  loading: false,
  loadingMore: false,
  hasMore: false,
  unreadOnly: false,
  activeEntryId: null,

  setEntries: (entries, total, hasMore) =>
    set({ entries, totalCount: total, hasMore }),
  appendEntries: (newEntries, hasMore) =>
    set((s) => ({
      entries: [...s.entries, ...newEntries],
      hasMore,
    })),
  setLoading: (loading) => set({ loading }),
  setLoadingMore: (loadingMore) => set({ loadingMore }),
  setUnreadOnly: (unreadOnly) => set({ unreadOnly }),
  setActiveEntry: (id) => set({ activeEntryId: id }),
  updateEntry: (id, updates) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),
  removeEntries: (ids) =>
    set((s) => ({
      entries: s.entries.filter((e) => !ids.includes(e.id)),
    })),
}));

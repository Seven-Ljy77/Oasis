// =============================================================================
// Mercury — Tag Store
// =============================================================================

import { create } from "zustand";
import type { TagInfo, TagLibraryItem, TagSuggestion } from "@/lib/types";
import * as ipc from "@/lib/ipc";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface TagState {
  tags: TagInfo[];
  tagLibrary: TagLibraryItem[];
  tagUsageMap: Record<number, TagInfo[]>; // entry_id -> tags

  selectedTagIds: number[];
  isLoading: boolean;
  error: string | null;

  // Batch AI tagging run state
  batchRunState: {
    taskId: string | null;
    total: number;
    completed: number;
    phase: "idle" | "running" | "completed" | "failed";
  };

  // Actions
  loadTags: () => Promise<void>;
  loadTagLibrary: () => Promise<void>;
  createTag: (name: string, isProvisional?: boolean) => Promise<TagInfo | null>;
  assignTag: (entryId: number, tagId: number) => Promise<void>;
  removeTag: (entryId: number, tagId: number) => Promise<void>;
  renameTag: (tagId: number, newName: string) => Promise<void>;
  mergeTag: (sourceTagId: number, targetTagId: number) => Promise<void>;
  deleteTag: (tagId: number) => Promise<void>;
  suggestTags: (entryId: number) => Promise<TagSuggestion[]>;
  loadTagsForEntry: (entryId: number) => Promise<void>;

  // Selection
  selectTag: (tagId: number) => void;
  deselectTag: (tagId: number) => void;
  toggleTag: (tagId: number) => void;
  clearTagSelection: () => void;

  // Batch
  startBatchTagging: (entryIds: number[]) => Promise<void>;
  updateBatchProgress: (completed: number, total: number) => void;
  finishBatchTagging: (success: boolean) => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState = {
  tags: [] as TagInfo[],
  tagLibrary: [] as TagLibraryItem[],
  tagUsageMap: {} as Record<number, TagInfo[]>,

  selectedTagIds: [] as number[],
  isLoading: false,
  error: null as string | null,

  batchRunState: {
    taskId: null as string | null,
    total: 0,
    completed: 0,
    phase: "idle" as "idle" | "running" | "completed" | "failed",
  },
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTagStore = create<TagState>()((set, get) => ({
  ...initialState,

  loadTags: async () => {
    set({ isLoading: true, error: null });
    try {
      // One-time cleanup: remove empty tags from previous buggy sessions
      await ipc.cleanupEmptyTags();
      const tags = await ipc.getTags();
      set({ tags, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
    }
  },

  loadTagLibrary: async () => {
    try {
      const tagLibrary = await ipc.getTagLibrary();
      set({ tagLibrary });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  createTag: async (name, isProvisional) => {
    try {
      const tag = await ipc.createTag(name, isProvisional);
      set((s) => ({ tags: [...s.tags, tag] }));
      return tag;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      return null;
    }
  },

  assignTag: async (entryId, tagId) => {
    // Optimistic: add tag to entry in local map
    const tag = get().tags.find((t) => t.id === tagId);
    if (tag) {
      set((s) => ({
        tagUsageMap: {
          ...s.tagUsageMap,
          [entryId]: [...(s.tagUsageMap[entryId] || []), tag],
        },
      }));
    }

    try {
      await ipc.assignTag(entryId, tagId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      // TODO: rollback
    }
  },

  removeTag: async (entryId, tagId) => {
    // Optimistic
    set((s) => ({
      tagUsageMap: {
        ...s.tagUsageMap,
        [entryId]: (s.tagUsageMap[entryId] || []).filter(
          (t) => t.id !== tagId,
        ),
      },
    }));

    try {
      await ipc.removeTag(entryId, tagId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      // TODO: rollback
    }
  },

  renameTag: async (tagId, newName) => {
    // Optimistic
    set((s) => ({
      tags: s.tags.map((t) =>
        t.id === tagId ? { ...t, name: newName } : t,
      ),
    }));

    try {
      const updated = await ipc.renameTag(tagId, newName);
      set((s) => ({
        tags: s.tags.map((t) => (t.id === tagId ? updated : t)),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      // TODO: rollback
    }
  },

  mergeTag: async (sourceTagId, targetTagId) => {
    try {
      await ipc.mergeTag(sourceTagId, targetTagId);
      // Reload tags to reflect merged state
      await get().loadTags();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  deleteTag: async (tagId) => {
    try {
      await ipc.deleteTag(tagId);
      set((s) => ({
        tags: s.tags.filter((t) => t.id !== tagId),
        selectedTagIds: s.selectedTagIds.filter((id) => id !== tagId),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  suggestTags: async (entryId) => {
    try {
      const suggestions = await ipc.suggestTags(entryId);
      return suggestions;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      return [];
    }
  },

  loadTagsForEntry: async (entryId) => {
    try {
      const tags = await ipc.getTagsForEntry(entryId);
      set((s) => ({
        tagUsageMap: { ...s.tagUsageMap, [entryId]: tags },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  // Selection
  selectTag: (tagId) =>
    set((s) => ({
      selectedTagIds: s.selectedTagIds.includes(tagId)
        ? s.selectedTagIds
        : [...s.selectedTagIds, tagId],
    })),

  deselectTag: (tagId) =>
    set((s) => ({
      selectedTagIds: s.selectedTagIds.filter((id) => id !== tagId),
    })),

  toggleTag: (tagId) =>
    set((s) => ({
      selectedTagIds: s.selectedTagIds.includes(tagId)
        ? s.selectedTagIds.filter((id) => id !== tagId)
        : [...s.selectedTagIds, tagId],
    })),

  clearTagSelection: () => set({ selectedTagIds: [] }),

  // Batch
  startBatchTagging: async (entryIds) => {
    set({
      batchRunState: {
        taskId: null,
        total: entryIds.length,
        completed: 0,
        phase: "running",
      },
    });

    try {
      const { task_id } = await ipc.startBatchTagging(entryIds);
      set((s) => ({
        batchRunState: { ...s.batchRunState, taskId: task_id },
      }));
    } catch (err) {
      set((s) => ({
        batchRunState: { ...s.batchRunState, phase: "failed" },
      }));
    }
  },

  updateBatchProgress: (completed, total) =>
    set({ batchRunState: { taskId: null, total, completed, phase: "running" } }),

  finishBatchTagging: (success) =>
    set({
      batchRunState: {
        taskId: null,
        total: 0,
        completed: 0,
        phase: success ? "completed" : "failed",
      },
    }),
}));

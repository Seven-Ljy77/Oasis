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

let tagMutationSequence = 0;
const entryTagMutationTails = new Map<string, Promise<void>>();
const entryTagConfirmedValues = new Map<string, TagInfo | null>();
const entryTagConfirmedIndexes = new Map<string, number>();
const entryTagLatestVersions = new Map<string, number>();
const entryTagPendingCounts = new Map<string, number>();
const renameMutationVersions = new Map<number, number>();
const renameMutationTails = new Map<number, Promise<void>>();
const renameConfirmedValues = new Map<number, TagInfo>();
const renamePendingCounts = new Map<number, number>();

function renameTagInUsageMap(
  usageMap: Record<number, TagInfo[]>,
  tagId: number,
  name: string,
): Record<number, TagInfo[]> {
  return Object.fromEntries(
    Object.entries(usageMap).map(([entryId, entryTags]) => [
      entryId,
      entryTags.map((tag) => (tag.id === tagId ? { ...tag, name } : tag)),
    ]),
  );
}

function replaceTagInUsageMap(
  usageMap: Record<number, TagInfo[]>,
  tagId: number,
  replacement: TagInfo,
): Record<number, TagInfo[]> {
  return Object.fromEntries(
    Object.entries(usageMap).map(([entryId, entryTags]) => [
      entryId,
      entryTags.map((tag) => (tag.id === tagId ? replacement : tag)),
    ]),
  );
}

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
    const mutationKey = entryId + ":" + tagId;
    const mutationVersion = ++tagMutationSequence;
    const previous = get().tagUsageMap[entryId] || [];
    const pendingCount = entryTagPendingCounts.get(mutationKey) ?? 0;
    if (pendingCount === 0) {
      const confirmedIndex = previous.findIndex((item) => item.id === tagId);
      entryTagConfirmedValues.set(
        mutationKey,
        confirmedIndex >= 0 ? previous[confirmedIndex] : null,
      );
      entryTagConfirmedIndexes.set(mutationKey, confirmedIndex);
    }
    entryTagPendingCounts.set(mutationKey, pendingCount + 1);
    entryTagLatestVersions.set(mutationKey, mutationVersion);
    // Optimistic: add tag to entry in local map
    const tag = get().tags.find((t) => t.id === tagId);
    if (tag) {
      set((s) => ({
        error: null,
        tagUsageMap: {
          ...s.tagUsageMap,
          [entryId]: (s.tagUsageMap[entryId] || []).some(
            (existing) => existing.id === tag.id,
          )
            ? s.tagUsageMap[entryId]
            : [...(s.tagUsageMap[entryId] || []), tag],
        },
      }));
    }

    const preceding = entryTagMutationTails.get(mutationKey) ?? Promise.resolve();
    const operation = preceding
      .catch(() => undefined)
      .then(() => ipc.assignTag(entryId, tagId));
    const settledOperation = operation.catch(() => undefined);
    entryTagMutationTails.set(mutationKey, settledOperation);
    let failureMessage: string | null = null;
    try {
      await operation;
      if (tag) {
        entryTagConfirmedValues.set(mutationKey, tag);
        const current = get().tagUsageMap[entryId] || [];
        entryTagConfirmedIndexes.set(
          mutationKey,
          current.findIndex((item) => item.id === tagId),
        );
      }
    } catch (err) {
      failureMessage = err instanceof Error ? err.message : String(err);
    } finally {
      const isLatest =
        entryTagLatestVersions.get(mutationKey) === mutationVersion;
      if (isLatest) {
        set((state) => {
          const current = (state.tagUsageMap[entryId] || []).filter(
            (candidate) => candidate.id !== tagId,
          );
          const confirmed = entryTagConfirmedValues.get(mutationKey);
          if (confirmed) {
            const index = entryTagConfirmedIndexes.get(mutationKey) ?? current.length;
            current.splice(Math.min(Math.max(index, 0), current.length), 0, confirmed);
          }
          return {
            error: failureMessage ?? state.error,
            tagUsageMap: { ...state.tagUsageMap, [entryId]: current },
          };
        });
      }
      const remaining = (entryTagPendingCounts.get(mutationKey) ?? 1) - 1;
      if (remaining === 0) {
        entryTagPendingCounts.delete(mutationKey);
        entryTagConfirmedValues.delete(mutationKey);
        entryTagConfirmedIndexes.delete(mutationKey);
        entryTagLatestVersions.delete(mutationKey);
        if (entryTagMutationTails.get(mutationKey) === settledOperation) {
          entryTagMutationTails.delete(mutationKey);
        }
      } else {
        entryTagPendingCounts.set(mutationKey, remaining);
      }
    }
  },

  removeTag: async (entryId, tagId) => {
    const mutationKey = entryId + ":" + tagId;
    const mutationVersion = ++tagMutationSequence;
    const previous = get().tagUsageMap[entryId] || [];
    const removedIndex = previous.findIndex((tag) => tag.id === tagId);
    const pendingCount = entryTagPendingCounts.get(mutationKey) ?? 0;
    if (pendingCount === 0) {
      entryTagConfirmedValues.set(
        mutationKey,
        removedIndex >= 0 ? previous[removedIndex] : null,
      );
      entryTagConfirmedIndexes.set(mutationKey, removedIndex);
    }
    entryTagPendingCounts.set(mutationKey, pendingCount + 1);
    entryTagLatestVersions.set(mutationKey, mutationVersion);
    // Optimistic
    set((s) => ({
      error: null,
      tagUsageMap: {
        ...s.tagUsageMap,
        [entryId]: (s.tagUsageMap[entryId] || []).filter(
          (t) => t.id !== tagId,
        ),
      },
    }));

    const preceding = entryTagMutationTails.get(mutationKey) ?? Promise.resolve();
    const operation = preceding
      .catch(() => undefined)
      .then(() => ipc.removeTag(entryId, tagId));
    const settledOperation = operation.catch(() => undefined);
    entryTagMutationTails.set(mutationKey, settledOperation);
    let failureMessage: string | null = null;
    try {
      await operation;
      entryTagConfirmedValues.set(mutationKey, null);
    } catch (err) {
      failureMessage = err instanceof Error ? err.message : String(err);
    } finally {
      const isLatest =
        entryTagLatestVersions.get(mutationKey) === mutationVersion;
      if (isLatest) {
        set((state) => {
          const current = (state.tagUsageMap[entryId] || []).filter(
            (candidate) => candidate.id !== tagId,
          );
          const confirmed = entryTagConfirmedValues.get(mutationKey);
          if (confirmed) {
            const index = entryTagConfirmedIndexes.get(mutationKey) ?? current.length;
            current.splice(Math.min(Math.max(index, 0), current.length), 0, confirmed);
          }
          return {
            error: failureMessage ?? state.error,
            tagUsageMap: { ...state.tagUsageMap, [entryId]: current },
          };
        });
      }
      const remaining = (entryTagPendingCounts.get(mutationKey) ?? 1) - 1;
      if (remaining === 0) {
        entryTagPendingCounts.delete(mutationKey);
        entryTagConfirmedValues.delete(mutationKey);
        entryTagConfirmedIndexes.delete(mutationKey);
        entryTagLatestVersions.delete(mutationKey);
        if (entryTagMutationTails.get(mutationKey) === settledOperation) {
          entryTagMutationTails.delete(mutationKey);
        }
      } else {
        entryTagPendingCounts.set(mutationKey, remaining);
      }
    }
  },

  renameTag: async (tagId, newName) => {
    const mutationVersion = ++tagMutationSequence;
    renameMutationVersions.set(tagId, mutationVersion);
    const pendingCount = renamePendingCounts.get(tagId) ?? 0;
    if (pendingCount === 0) {
      const current = get().tags.find((tag) => tag.id === tagId);
      if (current) renameConfirmedValues.set(tagId, current);
    }
    renamePendingCounts.set(tagId, pendingCount + 1);
    // Optimistic
    set((s) => ({
      error: null,
      tags: s.tags.map((t) =>
        t.id === tagId ? { ...t, name: newName } : t,
      ),
      tagUsageMap: renameTagInUsageMap(s.tagUsageMap, tagId, newName),
    }));

    const preceding = renameMutationTails.get(tagId) ?? Promise.resolve();
    const operation = preceding
      .catch(() => undefined)
      .then(() => ipc.renameTag(tagId, newName));
    const settledOperation = operation.then(
      () => undefined,
      () => undefined,
    );
    renameMutationTails.set(tagId, settledOperation);
    let failureMessage: string | null = null;
    try {
      const updated = await operation;
      renameConfirmedValues.set(tagId, updated);
    } catch (err) {
      failureMessage = err instanceof Error ? err.message : String(err);
    } finally {
      const isLatest = renameMutationVersions.get(tagId) === mutationVersion;
      if (isLatest) {
        const confirmed = renameConfirmedValues.get(tagId);
        set((state) => ({
          error: failureMessage,
          tags: confirmed
            ? state.tags.map((tag) => (tag.id === tagId ? confirmed : tag))
            : state.tags,
          tagUsageMap: confirmed
            ? replaceTagInUsageMap(state.tagUsageMap, tagId, confirmed)
            : state.tagUsageMap,
        }));
      }

      const remaining = (renamePendingCounts.get(tagId) ?? 1) - 1;
      if (remaining === 0) {
        renamePendingCounts.delete(tagId);
        renameConfirmedValues.delete(tagId);
        renameMutationVersions.delete(tagId);
        if (renameMutationTails.get(tagId) === settledOperation) {
          renameMutationTails.delete(tagId);
        }
      } else {
        renamePendingCounts.set(tagId, remaining);
      }
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
        tagUsageMap: Object.fromEntries(
          Object.entries(s.tagUsageMap).map(([entryId, entryTags]) => [
            entryId,
            entryTags.filter((tag) => tag.id !== tagId),
          ]),
        ),
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
        batchRunState: {
          ...s.batchRunState,
          taskId: task_id,
          completed: entryIds.length,
          phase: "completed",
        },
      }));
    } catch (err) {
      set((s) => ({
        error: err instanceof Error ? err.message : String(err),
        batchRunState: { ...s.batchRunState, phase: "failed" },
      }));
    }
  },

  updateBatchProgress: (completed, total) =>
    set((state) => ({
      batchRunState: {
        ...state.batchRunState,
        total,
        completed,
        phase: "running",
      },
    })),

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

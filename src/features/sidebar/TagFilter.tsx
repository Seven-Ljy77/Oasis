import React from "react";
import { useSidebarStore } from "@/stores/useSidebarStore";
import { useAppStore } from "@/stores/useAppStore";
import { useTagStore } from "@/stores/useTagStore";
import { useI18n } from "@/lib/i18n";
import ContextMenu, { type ContextMenuItem } from "@/components/ui/ContextMenu";
import { deleteTagsBatch, deleteUnusedTags } from "@/lib/ipc";
import type { TagInfo } from "@/lib/types";

const TagFilter: React.FC = () => {
  const { t } = useI18n();
  const tags = useTagStore((s) => s.tags);
  const isLoading = useTagStore((s) => s.isLoading);
  const deleteTag = useTagStore((s) => s.deleteTag);
  const loadTags = useTagStore((s) => s.loadTags);
  const openSheet = useAppStore((s) => s.openSheet);
  const setRenameTargetTagId = useAppStore((s) => s.setRenameTargetTagId);
  const setRenameTargetTagName = useAppStore((s) => s.setRenameTargetTagName);
  const setMergeSourceTagId = useAppStore((s) => s.setMergeSourceTagId);
  const setMergeSourceTagName = useAppStore((s) => s.setMergeSourceTagName);

  // Sidebar store for local tag filter selection
  const selectedTagIds = useSidebarStore((s) => s.selectedTagIds);
  const toggleTag = useSidebarStore((s) => s.toggleTag);
  const tagMatchMode = useAppStore((s) => s.tagMatchMode);
  const setTagMatchMode = useAppStore((s) => s.setTagMatchMode);
  const tagSearchText = useSidebarStore((s) => s.tagSearchText);
  const setTagSearchText = useSidebarStore((s) => s.setTagSearchText);
  const clearTags = useSidebarStore((s) => s.clearTags);
  const setSelectedTagIds = useAppStore((s) => s.setSelectedTagIds);

  const filteredTags = tagSearchText
    ? tags.filter((t) =>
        t.name.toLowerCase().includes(tagSearchText.toLowerCase()),
      )
    : tags;

  const getTagContextMenu = (tag: TagInfo): ContextMenuItem[] => [
    {
      label: t.common.rename,
      onClick: () => {
        setRenameTargetTagId(tag.id);
        setRenameTargetTagName(tag.name);
        openSheet("tagRename");
      },
    },
    {
      label: t.tagLibrary.mergeInto,
      onClick: () => {
        setMergeSourceTagId(tag.id);
        setMergeSourceTagName(tag.name);
        openSheet("tagMerge");
      },
    },
    {
      label: t.common.delete,
      danger: true,
      onClick: () => {
        if (window.confirm(`Delete tag "${tag.name}"? This cannot be undone.`)) {
          deleteTag(tag.id);
        }
      },
    },
  ];

  const handleToggleTag = (id: number) => {
    toggleTag(id);
    // sync to app store for entry filtering
    const nextIds = new Set(selectedTagIds);
    if (nextIds.has(id)) nextIds.delete(id);
    else nextIds.add(id);
    setSelectedTagIds(Array.from(nextIds));
  };

  const handleClearAll = () => {
    clearTags();
    setSelectedTagIds([]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ---- Header ---- */}
      <div className="px-3 py-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          {t.sidebar.tags}
        </h3>

        {/* Search input */}
        <input
          type="text"
          value={tagSearchText}
          onChange={(e) => setTagSearchText(e.target.value)}
          placeholder={t.sidebar.searchTags}
          className="w-full h-7 px-2 text-xs rounded-md border border-border bg-surface placeholder-slate-400 focus:outline-none focus:border-accent transition-colors"
        />

        {/* Match mode toggle */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-slate-400">Match:</span>
          <button
            onClick={() => setTagMatchMode("any")}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              tagMatchMode === "any"
                ? "bg-accent text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.sidebar.any}
          </button>
          <button
            onClick={() => setTagMatchMode("all")}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              tagMatchMode === "all"
                ? "bg-accent text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.sidebar.all}
          </button>
        </div>

        {/* Clear all */}
        {selectedTagIds.size > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleClearAll}
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              {t.sidebar.clearSelected}
            </button>
            <button
              onClick={async () => {
                const ids = Array.from(selectedTagIds);
                if (window.confirm(`Delete ${ids.length} selected tag(s)?`)) {
                  await deleteTagsBatch(ids);
                  clearTags();
                  setSelectedTagIds([]);
                  await loadTags();
                }
              }}
              className="text-xs text-red-500 hover:text-red-600 transition-colors"
            >
              {t.sidebar.deleteSelected}
            </button>
          </div>
        )}
        <button
          onClick={async () => {
            if (window.confirm("Delete all unused tags (usage count = 0)?")) {
              await deleteUnusedTags();
              await loadTags();
            }
          }}
          className="mt-1 text-xs text-red-400 hover:text-red-500 transition-colors"
        >
          {t.sidebar.deleteUnused}
        </button>
      </div>

      {/* ---- Tag list ---- */}
      <div className="flex-1 overflow-y-auto px-1">
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
            {t.common.loading}
          </div>
        )}

        {!isLoading && filteredTags.map((tag) => (
          <ContextMenu key={tag.id} items={getTagContextMenu(tag)}>
            <label
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                selectedTagIds.has(tag.id)
                  ? "bg-accent-muted"
                  : "hover:bg-surface-tertiary"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedTagIds.has(tag.id)}
                onChange={() => handleToggleTag(tag.id)}
                className="rounded border-slate-300 text-accent focus:ring-accent w-3.5 h-3.5"
              />
              <span
                className={`flex-1 text-left truncate ${
                  selectedTagIds.has(tag.id) ? "text-accent font-medium" : "text-slate-700"
                }`}
              >
                {tag.name}
              </span>
              <span className="text-xs text-slate-400">{tag.usage_count}</span>
            </label>
          </ContextMenu>
        ))}

        {!isLoading && filteredTags.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-400">
            {tagSearchText ? t.common.noData : t.common.noData}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagFilter;

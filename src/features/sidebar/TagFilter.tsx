import React from "react";
import { useSidebarStore } from "@/stores/useSidebarStore";
import { useAppStore } from "@/stores/useAppStore";
import ContextMenu, { type ContextMenuItem } from "@/components/ui/ContextMenu";
import type { TagInfo } from "@/lib/types";
// TODO: import { renameTag, deleteTag } from "@/lib/ipc";

const TagFilter: React.FC = () => {
  const tags = useSidebarStore((s) => s.tags);
  const selectedTagIds = useSidebarStore((s) => s.selectedTagIds);
  const toggleTag = useSidebarStore((s) => s.toggleTag);
  const tagMatchMode = useSidebarStore((s) => s.tagMatchMode);
  const setTagMatchMode = useSidebarStore((s) => s.setTagMatchMode);
  const tagSearchText = useSidebarStore((s) => s.tagSearchText);
  const setTagSearchText = useSidebarStore((s) => s.setTagSearchText);
  const clearTags = useSidebarStore((s) => s.clearTags);
  const setSelectedTagIds = useAppStore((s) => s.setSelectedTagIds);

  // Placeholder tags for UI
  const placeholderTags: TagInfo[] = tags.length > 0 ? tags : [
    { id: 1, name: "AI", normalized_name: "ai", is_provisional: false, usage_count: 45 },
    { id: 2, name: "Programming", normalized_name: "programming", is_provisional: false, usage_count: 32 },
    { id: 3, name: "Rust", normalized_name: "rust", is_provisional: true, usage_count: 8 },
    { id: 4, name: "TypeScript", normalized_name: "typescript", is_provisional: false, usage_count: 22 },
    { id: 5, name: "News", normalized_name: "news", is_provisional: false, usage_count: 67 },
  ] as TagInfo[];

  const filteredTags = tagSearchText
    ? placeholderTags.filter((t) =>
        t.name.toLowerCase().includes(tagSearchText.toLowerCase()),
      )
    : placeholderTags;

  const getTagContextMenu = (tag: TagInfo): ContextMenuItem[] => [
    {
      label: "Rename",
      onClick: () => {
        // TODO: open rename sheet with tag pre-selected
      },
    },
    {
      label: "Delete",
      danger: true,
      onClick: () => {
        // TODO: confirm, then deleteTag(tag.id)
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
          Tags
        </h3>

        {/* Search input */}
        <input
          type="text"
          value={tagSearchText}
          onChange={(e) => setTagSearchText(e.target.value)}
          placeholder="Filter tags..."
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
            Any
          </button>
          <button
            onClick={() => setTagMatchMode("all")}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              tagMatchMode === "all"
                ? "bg-accent text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            All
          </button>
        </div>

        {/* Clear all */}
        {selectedTagIds.size > 0 && (
          <button
            onClick={handleClearAll}
            className="mt-2 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Clear all ({selectedTagIds.size} selected)
          </button>
        )}
      </div>

      {/* ---- Tag list ---- */}
      <div className="flex-1 overflow-y-auto px-1">
        {filteredTags.map((tag) => (
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

        {filteredTags.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-400">
            {tagSearchText ? "No tags match your filter" : "No tags yet"}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagFilter;

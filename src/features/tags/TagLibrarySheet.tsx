import React, { useState } from "react";
import { useTagStore } from "@/stores/useTagStore";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import type { TagLibraryItem } from "@/lib/types";

interface TagLibrarySheetProps {
  open: boolean;
  onClose: () => void;
}

type FilterKind = "all" | "provisional" | "unused" | "hasAliases" | "duplicates";

const TagLibrarySheet: React.FC<TagLibrarySheetProps> = ({ open, onClose }) => {
  const tags = useTagStore((s) => s.tags);
  const tagLibrary = useTagStore((s) => s.tagLibrary);
  const renameTag = useTagStore((s) => s.renameTag);
  const deleteTag = useTagStore((s) => s.deleteTag);
  const mergeTag = useTagStore((s) => s.mergeTag);

  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [showMergePicker, setShowMergePicker] = useState(false);

  // Placeholder library items
  const placeholderLibrary: TagLibraryItem[] = tagLibrary.length > 0
    ? tagLibrary
    : [
        { id: 1, name: "AI", normalized_name: "ai", is_provisional: false, usage_count: 45, alias_count: 2, is_duplicate: false },
        { id: 2, name: "Programming", normalized_name: "programming", is_provisional: false, usage_count: 32, alias_count: 0, is_duplicate: false },
        { id: 3, name: "rust", normalized_name: "rust", is_provisional: true, usage_count: 8, alias_count: 1, is_duplicate: false },
        { id: 4, name: "artificial-intelligence", normalized_name: "artificial intelligence", is_provisional: false, usage_count: 22, alias_count: 3, is_duplicate: true },
        { id: 5, name: "Typescript", normalized_name: "typescript", is_provisional: false, usage_count: 18, alias_count: 0, is_duplicate: false },
        { id: 6, name: "aws", normalized_name: "aws", is_provisional: true, usage_count: 1, alias_count: 0, is_duplicate: false },
      ] as TagLibraryItem[];

  const placeholderAliases: Record<number, string[]> = {
    1: ["artificial-intelligence", "machine-learning"],
    3: ["Rust-lang"],
    4: ["AI", "machine-intelligence"],
  };

  const filteredTags = placeholderLibrary.filter((t) => {
    if (filter === "all") return true;
    if (filter === "provisional") return t.is_provisional;
    if (filter === "unused") return t.usage_count === 0;
    if (filter === "hasAliases") return t.alias_count > 0;
    if (filter === "duplicates") return t.is_duplicate;
    return true;
  }).filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedTag = placeholderLibrary.find((t) => t.id === selectedTagId);
  const aliases = selectedTag ? (placeholderAliases[selectedTag.id] ?? []) : [];

  const filters: { value: FilterKind; label: string }[] = [
    { value: "all", label: "All" },
    { value: "provisional", label: "Provisional" },
    { value: "unused", label: "Unused" },
    { value: "hasAliases", label: "Has Aliases" },
    { value: "duplicates", label: "Potential Duplicates" },
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Tag Library" width="800px" maxWidth="95vw">
      <div className="flex gap-4" style={{ minHeight: "400px" }}>
        {/* Left: tag list */}
        <div className="w-72 flex-shrink-0">
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags..."
            className="w-full h-7 px-2 text-xs rounded-md border border-border bg-surface focus:border-accent focus:outline-none mb-2"
          />

          {/* Filter pills */}
          <div className="flex flex-wrap gap-1 mb-2">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-2 py-0.5 text-[11px] rounded-full transition-colors ${
                  filter === f.value
                    ? "bg-accent text-white"
                    : "text-slate-500 border border-border hover:bg-surface-tertiary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Tag list */}
          <div className="overflow-y-auto max-h-[400px] border border-border rounded-lg">
            {filteredTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => setSelectedTagId(tag.id)}
                className={`w-full text-left px-3 py-2 border-b border-border/50 text-sm transition-colors ${
                  selectedTagId === tag.id
                    ? "bg-accent-muted text-accent"
                    : "text-slate-700 hover:bg-surface-tertiary"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate">{tag.name}</span>
                  {tag.is_provisional && (
                    <span className="text-[10px] bg-amber-100 text-amber-600 px-1 rounded">
                      Prov
                    </span>
                  )}
                  <span className="text-xs text-slate-400">({tag.usage_count})</span>
                </div>
              </button>
            ))}
            {filteredTags.length === 0 && (
              <div className="px-3 py-4 text-xs text-slate-400 text-center">
                No tags match your filter.
              </div>
            )}
          </div>
        </div>

        {/* Right: tag inspector */}
        <div className="flex-1 min-w-0">
          {!selectedTag ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-400">
              Select a tag from the list to inspect.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Identity section */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Identity</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24">Name:</span>
                    <span className="text-slate-700 font-medium">
                      {selectedTag.name}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24">Normalized:</span>
                    <span className="text-slate-600 font-mono text-xs">
                      {selectedTag.normalized_name}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24">Status:</span>
                    <span className={selectedTag.is_provisional ? "text-amber-600" : "text-green-600"}>
                      {selectedTag.is_provisional ? "Provisional" : "Active"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Aliases section */}
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-700">
                    Aliases ({aliases.length})
                  </h4>
                  <Button variant="ghost" size="sm">Add Alias</Button>
                </div>
                {aliases.length === 0 ? (
                  <p className="text-xs text-slate-400">No aliases defined.</p>
                ) : (
                  <div className="space-y-1">
                    {aliases.map((alias) => (
                      <div
                        key={alias}
                        className="flex items-center justify-between px-2 py-1 bg-surface-secondary rounded text-xs text-slate-600"
                      >
                        <span>{alias}</span>
                        <button className="text-slate-400 hover:text-red-500">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Potential duplicates */}
              {selectedTag.is_duplicate && (
                <div className="pt-2 border-t border-border/50">
                  <h4 className="text-sm font-semibold text-amber-600 mb-2">
                    Potential Duplicates
                  </h4>
                  <div className="space-y-1">
                    {placeholderLibrary
                      .filter((t) => t.is_duplicate && t.id !== selectedTag.id)
                      .slice(0, 3)
                      .map((dup) => (
                        <div
                          key={dup.id}
                          className="flex items-center justify-between px-2 py-1 bg-amber-50 rounded text-xs"
                        >
                          <span className="text-amber-700">{dup.name}</span>
                          <div className="flex gap-1">
                            <button className="text-amber-600 hover:text-amber-800">
                              Inspect
                            </button>
                            <button
                              onClick={() => {
                                setMergeTargetId(dup.id);
                                setShowMergePicker(true);
                              }}
                              className="text-amber-600 hover:text-amber-800"
                            >
                              Merge Into...
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Maintenance actions */}
              <div className="pt-2 border-t border-border space-y-2">
                <h4 className="text-sm font-semibold text-slate-700">Actions</h4>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm">
                    Rename
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setShowMergePicker(true)}>
                    Merge
                  </Button>
                  {selectedTag.is_provisional && (
                    <Button variant="secondary" size="sm">
                      Make Permanent
                    </Button>
                  )}
                  <Button variant="danger" size="sm">
                    Delete
                  </Button>
                </div>
              </div>

              {/* Merge picker */}
              {showMergePicker && (
                <div className="p-3 border border-accent rounded-lg mt-4 bg-accent-muted">
                  <h5 className="text-sm font-medium text-accent mb-2">
                    Merge "{selectedTag.name}" into:
                  </h5>
                  <select
                    className="w-full h-8 px-2 text-sm rounded border border-border bg-surface focus:border-accent focus:outline-none mb-2"
                    value={mergeTargetId ?? ""}
                    onChange={(e) => setMergeTargetId(Number(e.target.value))}
                  >
                    <option value="">Select target tag...</option>
                    {placeholderLibrary
                      .filter((t) => t.id !== selectedTag.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.usage_count} uses)
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-slate-500 mb-2">
                    {selectedTag.usage_count} usages will be transferred. Source tag will be deleted.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMergePicker(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!mergeTargetId}
                    >
                      Confirm Merge
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
};

export default TagLibrarySheet;

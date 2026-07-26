import React, { useState } from "react";
import { useTagStore } from "@/stores/useTagStore";
import { useI18n } from "@/lib/i18n";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import type { TagLibraryItem } from "@/lib/types";

interface TagLibrarySheetProps {
  open: boolean;
  onClose: () => void;
}

type FilterKind = "all" | "unused" | "hasAliases";

const TagLibrarySheet: React.FC<TagLibrarySheetProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const tags = useTagStore((s) => s.tags);
  const tagLibrary = useTagStore((s) => s.tagLibrary);
  const loadTags = useTagStore((s) => s.loadTags);
  const loadTagLibrary = useTagStore((s) => s.loadTagLibrary);
  const renameTag = useTagStore((s) => s.renameTag);
  const deleteTag = useTagStore((s) => s.deleteTag);
  const mergeTag = useTagStore((s) => s.mergeTag);

  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");

  // Load real data when sheet opens
  React.useEffect(() => {
    if (open) {
      loadTagLibrary();
    }
  }, [open, loadTagLibrary]);

  const displayTags = tagLibrary.length > 0 ? tagLibrary : [];

  // Build aliases from tagStore (flatten tag aliases)
  const aliasesForTag = (tagId: number): string[] => {
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) return [];
    // Tags with the same normalized_name but different names are effectively aliases
    const norm = tag.normalized_name;
    return tags
      .filter((t) => t.normalized_name === norm && t.id !== tagId)
      .map((t) => t.name);
  };

  const filteredTags = displayTags
    .filter((t) => {
      if (filter === "all") return true;
      if (filter === "unused") return t.usage_count === 0;
      if (filter === "hasAliases") return t.alias_count > 0;
      return true;
    })
    .filter(
      (t) =>
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()),
    );

  const selectedTag = displayTags.find((t) => t.id === selectedTagId);
  const aliases = selectedTag ? aliasesForTag(selectedTag.id) : [];

  const filters: { value: FilterKind; label: string }[] = [
    { value: "all", label: t.tagLibrary.filterAll },
    { value: "unused", label: t.tagLibrary.filterUnused },
    { value: "hasAliases", label: t.tagLibrary.filterHasAliases },
  ];

  const refresh = () => {
    loadTagLibrary();
    loadTags();
  };

  return (
    <Sheet open={open} onClose={onClose} title={t.tagLibrary.title} width="800px" maxWidth="95vw">
      <div className="flex gap-4" style={{ minHeight: "400px" }}>
        {/* Left: tag list */}
        <div className="w-72 flex-shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.tagLibrary.search}
            className="w-full h-7 px-2 text-xs rounded-md border border-border bg-surface focus:border-accent focus:outline-none mb-2"
          />

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

          <div className="overflow-y-auto max-h-[400px] border border-border rounded-lg">
            {filteredTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => {
                  setSelectedTagId(tag.id);
                  setShowMergePicker(false);
                  setRenaming(false);
                }}
                className={`w-full text-left px-3 py-2 border-b border-border/50 text-sm transition-colors ${
                  selectedTagId === tag.id
                    ? "bg-accent-muted text-accent"
                    : "text-slate-700 hover:bg-surface-tertiary"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate">{tag.name}</span>
                  <span className="text-xs text-slate-400">({tag.usage_count})</span>
                </div>
              </button>
            ))}
            {filteredTags.length === 0 && (
              <div className="px-3 py-4 text-xs text-slate-400 text-center">
                {t.common.noData}
              </div>
            )}
          </div>
        </div>

        {/* Right: tag inspector */}
        <div className="flex-1 min-w-0">
          {!selectedTag ? (
            <div className="flex items-center justify-center h-full text-sm text-slate-400">
              {t.common.noData}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Identity */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">{t.tagLibrary.identity}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24">{t.tagLibrary.name}:</span>
                    {renaming ? (
                      <div className="flex gap-1">
                        <input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="h-6 px-1 text-xs border rounded w-32"
                          autoFocus
                        />
                        <Button size="sm" onClick={async () => {
                          if (newName.trim()) {
                            await renameTag(selectedTag.id, newName.trim());
                            setRenaming(false);
                            refresh();
                          }
                        }}>{t.common.confirm}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>{t.common.cancel}</Button>
                      </div>
                    ) : (
                      <span className="text-slate-700 font-medium">{selectedTag.name}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24">{t.tagLibrary.normalizedName}:</span>
                    <span className="text-slate-600 font-mono text-xs">{selectedTag.normalized_name}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24">{t.tagLibrary.status}:</span>
                    <span className={selectedTag.is_provisional ? "text-amber-600" : "text-green-600"}>
                      {selectedTag.is_provisional ? t.tagLibrary.provisional : t.tagLibrary.permanent}
                    </span>
                  </div>
                </div>
              </div>

              {/* Aliases */}
              <div className="pt-2 border-t border-border/50">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">{t.tagLibrary.aliases} ({aliases.length})</h4>
                {aliases.length === 0 ? (
                  <p className="text-xs text-slate-400">{t.common.noData}</p>
                ) : (
                  <div className="space-y-1">
                    {aliases.map((alias) => (
                      <div key={alias} className="flex items-center justify-between px-2 py-1 bg-surface-secondary rounded text-xs text-slate-600">
                        <span>{alias}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-border space-y-2">
                <h4 className="text-sm font-semibold text-slate-700">{t.tagLibrary.actions}</h4>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => {
                    setNewName(selectedTag.name);
                    setRenaming(true);
                  }}>{t.tagLibrary.rename}</Button>
                  <Button variant="secondary" size="sm" onClick={() => setShowMergePicker(true)}>{t.tagLibrary.mergeInto}</Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      if (confirm(`Delete tag "${selectedTag.name}"? This cannot be undone.`)) {
                        await deleteTag(selectedTag.id);
                        setSelectedTagId(null);
                        refresh();
                      }
                    }}
                  >{t.tagLibrary.delete}</Button>
                </div>
              </div>

              {/* Merge picker */}
              {showMergePicker && (
                <div className="p-3 border border-accent rounded-lg mt-4 bg-accent-muted">
                  <h5 className="text-sm font-medium text-accent mb-2">
                    {t.tagLibrary.mergeInto} "{selectedTag.name}":
                  </h5>
                  <select
                    className="w-full h-8 px-2 text-sm rounded border border-border bg-surface focus:border-accent focus:outline-none mb-2"
                    value={mergeTargetId ?? ""}
                    onChange={(e) => setMergeTargetId(Number(e.target.value))}
                  >
                    <option value="">{t.tagLibrary.mergeInto}...</option>
                    {displayTags
                      .filter((t) => t.id !== selectedTag.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.usage_count} uses)
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-slate-500 mb-2">
                    {selectedTag.usage_count} usages + aliases will be transferred. Source tag will be deleted.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowMergePicker(false)}>{t.common.cancel}</Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!mergeTargetId}
                      onClick={async () => {
                        if (mergeTargetId) {
                          await mergeTag(selectedTag.id, mergeTargetId);
                          setShowMergePicker(false);
                          setSelectedTagId(null);
                          refresh();
                        }
                      }}
                    >{t.common.confirm}</Button>
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

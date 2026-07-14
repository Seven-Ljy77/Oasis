import React, { useState } from "react";
import { useTagStore } from "@/stores/useTagStore";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import type { TagInfo } from "@/lib/types";

interface TagMergeSheetProps {
  open: boolean;
  onClose: () => void;
  sourceTagId: number | null;
  sourceTagName: string;
  tags: TagInfo[];
}

const TagMergeSheet: React.FC<TagMergeSheetProps> = ({ open, onClose, sourceTagId, sourceTagName, tags }) => {
  const [searchText, setSearchText] = useState("");
  const [targetTagId, setTargetTagId] = useState<number | null>(null);
  const mergeTag = useTagStore((s) => s.mergeTag);
  const loadTags = useTagStore((s) => s.loadTags);

  const availableTargets = tags.filter(
    t => t.id !== sourceTagId && t.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleMerge = async () => {
    if (!sourceTagId || !targetTagId) return;
    await mergeTag(sourceTagId, targetTagId);
    await loadTags();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Merge Tag" width="400px">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Source Tag</label>
          <input type="text" readOnly value={sourceTagName}
            className="w-full h-8 px-3 text-sm rounded-md border border-border bg-surface-secondary text-slate-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Target Tag (all articles will be moved here)
          </label>
          <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search tags..." autoFocus
            className="w-full h-8 px-3 text-sm rounded-md border border-border bg-surface focus:border-accent focus:outline-none mb-2" />
          <div className="max-h-40 overflow-y-auto border border-border rounded-md">
            {availableTargets.map(t => (
              <button key={t.id}
                onClick={() => setTargetTagId(t.id)}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                  targetTagId === t.id ? "bg-accent-muted text-accent font-medium" : "hover:bg-surface-tertiary text-slate-700"
                }`}>
                {t.name}
                <span className="text-xs text-slate-400 ml-2">({t.usage_count} articles)</span>
              </button>
            ))}
            {availableTargets.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-slate-400">No matching tags</div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
          <Button variant="danger" size="md" onClick={handleMerge} disabled={!targetTagId}>
            Merge
          </Button>
        </div>
      </div>
    </Sheet>
  );
};

export default TagMergeSheet;

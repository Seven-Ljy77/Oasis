import React, { useEffect, useState } from "react";
import { useEntryStore } from "@/stores/useEntryStore";
import { useReaderStore } from "@/stores/useReaderStore";
import { useTagStore } from "@/stores/useTagStore";
import type { TagSuggestion, TagInfo } from "@/lib/types";
import Button from "@/components/ui/Button";

const ReaderTaggingPanel: React.FC = () => {
  const selectedEntryId = useEntryStore((s) => s.selectedEntryId);
  const activePanel = useReaderStore((s) => s.activePanel);
  const setActivePanel = useReaderStore((s) => s.setActivePanel);

  const tags = useTagStore((s) => s.tags);
  const entryTags = useTagStore((s) =>
    selectedEntryId ? s.tagUsageMap[selectedEntryId] : undefined,
  );
  const loadTags = useTagStore((s) => s.loadTags);
  const loadTagsForEntry = useTagStore((s) => s.loadTagsForEntry);
  const assignTag = useTagStore((s) => s.assignTag);
  const removeTag = useTagStore((s) => s.removeTag);
  const createTag = useTagStore((s) => s.createTag);
  const suggestTags = useTagStore((s) => s.suggestTags);

  const [tagInput, setTagInput] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<TagSuggestion[]>([]);
  const [nlpSuggestions, setNlpSuggestions] = useState<TagSuggestion[]>([]);

  const open = activePanel === "tagging" && selectedEntryId !== null;

  // Load entry tags and suggestions when panel opens
  useEffect(() => {
    if (!open || !selectedEntryId) return;

    loadTagsForEntry(selectedEntryId);
    suggestTags(selectedEntryId).then((suggestions) => {
      const ai = suggestions.filter((s) => s.source === "ai");
      const nlp = suggestions.filter((s) => s.source === "nlp");
      setAiSuggestions(ai);
      setNlpSuggestions(nlp);
    });
  }, [open, selectedEntryId]);

  // Build list of existing tags NOT yet assigned to this entry
  const assignedTagIds = new Set((entryTags ?? []).map((t) => t.id));
  const existingTags: TagSuggestion[] = tags
    .filter((t) => !assignedTagIds.has(t.id))
    .map((t) => ({
      name: t.name,
      source: "existing" as const,
      tag_id: t.id,
    }));

  const handleApplyTag = async (tagName: string, tagId?: number) => {
    if (!selectedEntryId) return;

    let resolvedTagId = tagId;

    if (!resolvedTagId) {
      // Look up tag by name, or create it
      const existing = tags.find(
        (t) => t.normalized_name === tagName.toLowerCase().trim(),
      );
      if (existing) {
        resolvedTagId = existing.id;
      } else {
        const created = await createTag(tagName, true);
        if (created) {
          resolvedTagId = created.id;
        } else {
          return; // creation failed
        }
      }
    }

    await assignTag(selectedEntryId, resolvedTagId);
    // Refresh entry tags and global tag counts
    loadTagsForEntry(selectedEntryId);
    loadTags();
  };

  const handleRemoveTag = async (tagId: number) => {
    if (!selectedEntryId) return;
    await removeTag(selectedEntryId, tagId);
    loadTagsForEntry(selectedEntryId);
    loadTags();
  };

  const handleAddTagFromInput = async () => {
    const names = tagInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const name of names) {
      await handleApplyTag(name);
    }
    setTagInput("");
  };

  if (!open) return null;

  return (
    <div className="absolute right-2 top-12 z-50 w-72 bg-surface border border-border rounded-lg shadow-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Tag this article</h3>
        <button
          onClick={() => setActivePanel(null)}
          className="p-0.5 rounded text-slate-400 hover:text-slate-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Currently assigned tags */}
      {(entryTags ?? []).length > 0 && (
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
            Assigned Tags
          </label>
          <div className="flex flex-wrap gap-1">
            {(entryTags ?? []).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-accent-muted text-accent border border-accent/30"
              >
                {tag.name}
                <button
                  onClick={() => handleRemoveTag(tag.id)}
                  className="ml-0.5 hover:text-red-500 transition-colors"
                  title="Remove tag"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tag input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddTagFromInput();
          }}
          placeholder="Add tags (comma separated)..."
          className="flex-1 h-7 px-2 text-xs rounded-md border border-border bg-surface focus:border-accent focus:outline-none"
        />
        <Button variant="primary" size="sm" onClick={handleAddTagFromInput}>
          Add
        </Button>
      </div>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
            AI Suggestions
          </label>
          <div className="flex flex-wrap gap-1">
            {aiSuggestions.map((s) => (
              <button
                key={s.name}
                onClick={() => handleApplyTag(s.name, s.tag_id)}
                className="px-2 py-0.5 text-xs rounded-full bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 transition-colors"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* NLP Suggestions */}
      {nlpSuggestions.length > 0 && (
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
            NLP Suggestions
          </label>
          <div className="flex flex-wrap gap-1">
            {nlpSuggestions.map((s) => (
              <button
                key={s.name}
                onClick={() => handleApplyTag(s.name, s.tag_id)}
                className="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-colors"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Existing Tags */}
      {existingTags.length > 0 && (
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
            Existing Tags
          </label>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            {existingTags.map((s) => (
              <button
                key={s.name}
                onClick={() => handleApplyTag(s.name, s.tag_id)}
                className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Done button */}
      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={() => setActivePanel(null)}
      >
        Done
      </Button>
    </div>
  );
};

export default ReaderTaggingPanel;

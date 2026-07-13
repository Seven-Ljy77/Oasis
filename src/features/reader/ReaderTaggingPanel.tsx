import React, { useState } from "react";
import type { TagSuggestion } from "@/lib/types";
import Button from "@/components/ui/Button";

// TODO: import { suggestTags, assignTag, getTagsForEntry } from "@/lib/ipc";

const ReaderTaggingPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<TagSuggestion[]>([
    { name: "programming", source: "ai" },
    { name: "rust-lang", source: "ai" },
    { name: "tutorial", source: "ai" },
  ]);
  const [nlpSuggestions, setNlpSuggestions] = useState<TagSuggestion[]>([
    { name: "technology", source: "nlp" },
    { name: "guide", source: "nlp" },
  ]);
  const [existingTags, setExistingTags] = useState<TagSuggestion[]>([
    { name: "dev", source: "existing", tag_id: 1 },
    { name: "reading-list", source: "existing", tag_id: 2 },
    { name: "favorites", source: "existing", tag_id: 3 },
  ]);

  const handleApplyTag = (tagName: string) => {
    // TODO: assign tag to current entry via IPC
    console.log("Apply tag:", tagName);
  };

  const handleAddTagFromInput = () => {
    const names = tagInput.split(",").map((s) => s.trim()).filter(Boolean);
    names.forEach((name) => {
      // TODO: create and assign tag
      handleApplyTag(name);
    });
    setTagInput("");
  };

  if (!open) return null;

  return (
    <div className="absolute right-2 top-12 z-50 w-72 bg-surface border border-border rounded-lg shadow-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Tag this article</h3>

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
                onClick={() => handleApplyTag(s.name)}
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
                onClick={() => handleApplyTag(s.name)}
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
          <div className="flex flex-wrap gap-1">
            {existingTags.map((s) => (
              <button
                key={s.name}
                onClick={() => handleApplyTag(s.name)}
                className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Done button */}
      <Button variant="secondary" size="sm" className="w-full" onClick={() => setOpen(false)}>
        Done
      </Button>
    </div>
  );
};

export default ReaderTaggingPanel;

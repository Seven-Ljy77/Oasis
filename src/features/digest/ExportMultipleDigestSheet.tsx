import React, { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

interface ExportMultipleDigestSheetProps {
  open: boolean;
  onClose: () => void;
}

const ExportMultipleDigestSheet: React.FC<ExportMultipleDigestSheetProps> = ({
  open,
  onClose,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [digestTitle, setDigestTitle] = useState(`Digest ${today}`);
  const [filename, setFilename] = useState(`digest-${today}`);
  const [exportPath, setExportPath] = useState("C:/Users/Documents/Mercury/Digests");
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeNote, setIncludeNote] = useState(true);

  // Placeholder selected entries
  const selectedEntries = [
    { id: 1, title: "Getting Started with Rust and Tauri", author: "Jane Doe", note: "Great intro article" },
    { id: 2, title: "TypeScript 5.7 Released: What's New", author: null, note: "" },
    { id: 3, title: "Understanding React Server Components", author: "Alex Chen", note: "Must read for RSC migration" },
  ];

  const buildMarkdown = () => {
    let md = `# ${digestTitle}\n\n`;
    md += `*Generated on ${new Date().toLocaleDateString()}*\n\n`;
    md += `---\n\n`;

    selectedEntries.forEach((entry, idx) => {
      md += `## ${idx + 1}. ${entry.title}\n\n`;
      if (entry.author) md += `*by ${entry.author}*\n\n`;
      if (includeSummary) {
        md += `Summary: Placeholder summary for "${entry.title}".\n\n`;
      }
      if (includeNote && entry.note) {
        md += `> **Note:** ${entry.note}\n\n`;
      }
      md += `---\n\n`;
    });

    md += `*Exported by Mercury v0.1.0*`;
    return md;
  };

  const markdown = buildMarkdown();

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
  };

  const handleExport = () => {
    // TODO: invoke Tauri export command
    console.log("Export multiple to:", `${exportPath}/${filename}.md`);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Export Multiple Digest" width="640px">
      <div className="space-y-4">
        {/* Selected entries */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Selected Articles ({selectedEntries.length})
          </label>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {selectedEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 px-2 py-1 bg-surface-secondary rounded text-xs"
              >
                <span className="w-4 h-4 rounded-full bg-accent-muted text-accent flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                  {entry.id}
                </span>
                <span className="text-slate-700 truncate flex-1">{entry.title}</span>
                {entry.author && (
                  <span className="text-slate-400 flex-shrink-0">{entry.author}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Digest title */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Digest Title
          </label>
          <input
            type="text"
            value={digestTitle}
            onChange={(e) => setDigestTitle(e.target.value)}
            className="w-full h-8 px-2 text-sm rounded-md border border-border bg-surface focus:border-accent focus:outline-none"
          />
        </div>

        {/* Export filename */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Export Filename
          </label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="flex-1 h-8 px-2 text-sm rounded-md border border-border bg-surface focus:border-accent focus:outline-none"
            />
            <span className="text-sm text-slate-400">.md</span>
          </div>
        </div>

        {/* Export path */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Export Folder
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={exportPath}
              className="flex-1 h-8 px-2 text-sm rounded-md border border-border bg-surface-secondary text-slate-500 text-xs"
            />
            <Button variant="secondary" size="sm">Choose...</Button>
          </div>
        </div>

        {/* Include toggles */}
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSummary}
              onChange={(e) => setIncludeSummary(e.target.checked)}
              className="rounded border-slate-300 text-accent w-3.5 h-3.5"
            />
            <span className="text-sm text-slate-700">Include summaries</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeNote}
              onChange={(e) => setIncludeNote(e.target.checked)}
              className="rounded border-slate-300 text-accent w-3.5 h-3.5"
            />
            <span className="text-sm text-slate-700">Include notes</span>
          </label>
        </div>

        {/* Live preview */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Preview
          </label>
          <div className="p-3 bg-surface-secondary rounded-lg border border-border text-xs text-slate-600 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
            {markdown}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" size="md" onClick={handleCopy}>
            Copy
          </Button>
          <Button variant="primary" size="md" onClick={handleExport}>
            Export
          </Button>
        </div>
      </div>
    </Sheet>
  );
};

export default ExportMultipleDigestSheet;

// =============================================================================
// Mercury — DigestSettings (digest export settings)
// =============================================================================

import React from "react";

export interface DigestSettingsProps {
  className?: string;
}

const DigestSettings: React.FC<DigestSettingsProps> = ({ className = "" }) => {
  // TODO: import actual settings state

  const [exportFolder, setExportFolder] = React.useState("~/Documents/Mercury/Digests");
  const [templateName, setTemplateName] = React.useState("default");
  const [includeAuthor, setIncludeAuthor] = React.useState(true);
  const [includeDate, setIncludeDate] = React.useState(true);
  const [includeSummary, setIncludeSummary] = React.useState(true);
  const [includeSourceUrl, setIncludeSourceUrl] = React.useState(true);

  const templates = [
    { value: "default", label: "Default" },
    { value: "minimal", label: "Minimal" },
    { value: "academic", label: "Academic" },
    { value: "newsletter", label: "Newsletter Style" },
  ];

  return (
    <div
      data-component="DigestSettings"
      className={`p-4 space-y-5 ${className}`}
    >
      {/* Export folder path */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Export Folder
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={exportFolder}
            onChange={(e) => setExportFolder(e.target.value)}
            placeholder="Select export folder..."
            className="flex-1 h-8 px-2 text-sm rounded-md border border-border bg-surface focus:border-accent focus:outline-none truncate"
          />
          <button
            onClick={() => {
              // TODO: open native folder picker via Tauri dialog
            }}
            className="px-3 py-1 text-xs font-medium rounded border border-border bg-surface hover:bg-surface-secondary text-slate-600 transition-colors whitespace-nowrap"
          >
            Browse
          </button>
        </div>
      </div>

      {/* Template selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Export Template
        </label>
        <select
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          className="w-full h-8 px-2 text-sm rounded-md border border-border bg-surface focus:border-accent focus:outline-none"
        >
          {templates.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-400">
          Controls the layout and formatting of exported digests.
        </p>
      </div>

      {/* Template customization section */}
      <div className="pt-3 border-t border-border">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Template Customization
        </h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAuthor}
              onChange={(e) => setIncludeAuthor(e.target.checked)}
              className="rounded border-slate-300 text-accent w-4 h-4"
            />
            <span className="text-sm text-slate-600">Include article author</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDate}
              onChange={(e) => setIncludeDate(e.target.checked)}
              className="rounded border-slate-300 text-accent w-4 h-4"
            />
            <span className="text-sm text-slate-600">Include publication date</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSummary}
              onChange={(e) => setIncludeSummary(e.target.checked)}
              className="rounded border-slate-300 text-accent w-4 h-4"
            />
            <span className="text-sm text-slate-600">Include article summary</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSourceUrl}
              onChange={(e) => setIncludeSourceUrl(e.target.checked)}
              className="rounded border-slate-300 text-accent w-4 h-4"
            />
            <span className="text-sm text-slate-600">Include source URL</span>
          </label>
        </div>
      </div>

      {/* Template preview placeholder */}
      <div className="pt-3 border-t border-border">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Template Preview
        </h3>
        <div className="p-3 rounded-lg border border-border bg-surface-secondary text-xs text-slate-500 font-mono whitespace-pre-wrap">
          {`---\nTitle: {{ digest_title }}\nDate: {{ export_date }}\n---\n\n`}
          {`{{# each entries }}\n## {{ title }}`}
          {includeAuthor ? `\n*By {{ author }}*` : ""}
          {includeDate ? `\n*Published: {{ published_at }}*` : ""}
          {includeSummary ? `\n\n{{ summary }}` : ""}
          {includeSourceUrl ? `\n\n[Read original]({{ url }})` : ""}
          {`\n\n{{/ each }}`}
        </div>
      </div>
    </div>
  );
};

export default DigestSettings;

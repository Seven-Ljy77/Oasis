import React, { useState } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { Button } from "@/components/ui/Button";
import type { AgentProviderProfile, AgentModelProfile } from "@/lib/types";

type AgentTab = "providers" | "models" | "agents";

const AgentSettingsView: React.FC = () => {
  const [tab, setTab] = useState<AgentTab>("providers");

  return (
    <div className="p-4 space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5 w-fit">
        {(["providers", "models", "agents"] as AgentTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              tab === t
                ? "bg-surface text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "providers" && <ProviderTab />}
      {tab === "models" && <ModelTab />}
      {tab === "agents" && <AgentTab />}
    </div>
  );
};

// ---- Provider Tab ----

const ProviderTab: React.FC = () => {
  const providers = useSettingsStore((s) => s.providers);
  const loadProviders = useSettingsStore((s) => s.loadProviders);
  const addProvider = useSettingsStore((s) => s.addProvider);
  const deleteProvider = useSettingsStore((s) => s.deleteProvider);
  const archiveProvider = useSettingsStore((s) => s.archiveProvider);

  React.useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const displayProviders: AgentProviderProfile[] = providers.length > 0
    ? providers
    : [];

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newKey, setNewKey] = useState("");

  const handleAdd = async () => {
    const result = await addProvider(newName, newUrl, newKey);
    if (result) {
      setShowAdd(false);
      setNewName("");
      setNewUrl("");
      setNewKey("");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-slate-700">Providers</h4>
        <Button variant="secondary" size="sm" onClick={() => setShowAdd(!showAdd)}>
          Add Provider
        </Button>
      </div>

      {showAdd && (
        <div className="mb-3 p-3 border border-border rounded-lg space-y-2 bg-surface-secondary">
          <input
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full h-7 px-2 text-xs rounded border border-border focus:border-accent focus:outline-none"
          />
          <input
            placeholder="Base URL"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full h-7 px-2 text-xs rounded border border-border focus:border-accent focus:outline-none"
          />
          <input
            type="password"
            placeholder="API Key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="w-full h-7 px-2 text-xs rounded border border-border focus:border-accent focus:outline-none"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleAdd}>
              Save
            </Button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-slate-500">
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Base URL</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Default</th>
            <th className="py-2 pr-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayProviders.map((p) => (
            <tr key={p.id} className="border-b border-border/50">
              <td className="py-2 pr-4 text-slate-700">{p.name}</td>
              <td className="py-2 pr-4 text-slate-500 text-xs">{p.base_url}</td>
              <td className="py-2 pr-4">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    p.is_enabled
                      ? "bg-green-50 text-green-600"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {p.is_enabled ? "Active" : "Disabled"}
                </span>
              </td>
              <td className="py-2 pr-4">
                {p.is_default && (
                  <span className="text-xs bg-accent-muted text-accent px-1.5 py-0.5 rounded">
                    Default
                  </span>
                )}
              </td>
              <td className="py-2">
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm">Edit</Button>
                  <Button variant="ghost" size="sm">Test Connection</Button>
                  <Button variant="ghost" size="sm">Set Default</Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteProvider(p.id)}
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---- Model Tab ----

const ModelTab: React.FC = () => {
  const providers = useSettingsStore((s) => s.providers);
  const models = useSettingsStore((s) => s.models);
  const loadModels = useSettingsStore((s) => s.loadModels);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(
    providers[0]?.id ?? null,
  );

  React.useEffect(() => {
    if (selectedProviderId) {
      loadModels(selectedProviderId);
    }
  }, [selectedProviderId, loadModels]);

  const displayModels = models[selectedProviderId ?? 0] ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-slate-700">Models</h4>
        <Button variant="secondary" size="sm">Add Model</Button>
      </div>

      {providers.length > 0 && (
        <select
          value={selectedProviderId ?? ""}
          onChange={(e) => setSelectedProviderId(Number(e.target.value) || null)}
          className="w-48 h-7 px-2 mb-3 text-xs rounded border border-border bg-surface focus:border-accent focus:outline-none"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-slate-500">
            <th className="py-2 pr-4 font-medium">Model</th>
            <th className="py-2 pr-4 font-medium">Summary</th>
            <th className="py-2 pr-4 font-medium">Translation</th>
            <th className="py-2 pr-4 font-medium">Tagging</th>
            <th className="py-2 pr-4 font-medium">Default</th>
            <th className="py-2 pr-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {displayModels.map((m) => (
            <tr key={m.id} className="border-b border-border/50">
              <td className="py-2 pr-4 text-slate-700">{m.model_name}</td>
              <td className="py-2 pr-4">
                {m.supports_summary ? (
                  <span className="text-green-600 text-xs">Yes</span>
                ) : (
                  <span className="text-slate-300 text-xs">No</span>
                )}
              </td>
              <td className="py-2 pr-4">
                {m.supports_translation ? (
                  <span className="text-green-600 text-xs">Yes</span>
                ) : (
                  <span className="text-slate-300 text-xs">No</span>
                )}
              </td>
              <td className="py-2 pr-4">
                {m.supports_tagging ? (
                  <span className="text-green-600 text-xs">Yes</span>
                ) : (
                  <span className="text-slate-300 text-xs">No</span>
                )}
              </td>
              <td className="py-2 pr-4">
                {m.is_default && (
                  <span className="text-xs bg-accent-muted text-accent px-1.5 py-0.5 rounded">
                    Default
                  </span>
                )}
              </td>
              <td className="py-2">
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm">Edit</Button>
                  <Button variant="ghost" size="sm">Test Chat</Button>
                  <Button variant="ghost" size="sm">Set Default</Button>
                  <Button variant="ghost" size="sm">Delete</Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---- Agent Tab ----

const AgentTab: React.FC = () => {
  const agentTypes = [
    { type: "summary", label: "Summary Agent", description: "Generates article summaries" },
    { type: "translation", label: "Translation Agent", description: "Translates article content" },
    { type: "tagging", label: "Tagging Agent", description: "Auto-tags articles with relevant labels" },
  ];

  return (
    <div className="space-y-6">
      {agentTypes.map((agent) => (
        <div key={agent.type} className="border border-border rounded-lg p-4 space-y-3">
          <div>
            <h4 className="text-sm font-medium text-slate-700">{agent.label}</h4>
            <p className="text-xs text-slate-500">{agent.description}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Primary Model
            </label>
            <select className="w-48 h-7 px-2 text-xs rounded border border-border bg-surface focus:border-accent focus:outline-none">
              <option value="">Select a model...</option>
              <option value="1">qwen3</option>
              <option value="2">qwen3-thinking</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Fallback Model (optional)
            </label>
            <select className="w-48 h-7 px-2 text-xs rounded border border-border bg-surface focus:border-accent focus:outline-none">
              <option value="">None</option>
              <option value="1">qwen3</option>
              <option value="2">qwen3-thinking</option>
            </select>
          </div>

          {/* Agent-specific config */}
          {agent.type === "summary" && (
            <div className="space-y-2 pt-1 border-t border-border/50">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Default Target Language
                </label>
                <select className="w-48 h-7 px-2 text-xs rounded border border-border bg-surface focus:border-accent focus:outline-none">
                  <option value="zh-CN">Chinese (Simplified)</option>
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Default Detail Level
                </label>
                <select className="w-48 h-7 px-2 text-xs rounded border border-border bg-surface focus:border-accent focus:outline-none">
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300 text-accent w-3 h-3" />
                Auto-summary on article open
              </label>
            </div>
          )}

          {agent.type === "translation" && (
            <div className="space-y-2 pt-1 border-t border-border/50">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Default Target Language
                </label>
                <select className="w-48 h-7 px-2 text-xs rounded border border-border bg-surface focus:border-accent focus:outline-none">
                  <option value="zh-CN">Chinese (Simplified)</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Default Prompt Strategy
                </label>
                <select className="w-48 h-7 px-2 text-xs rounded border border-border bg-surface focus:border-accent focus:outline-none">
                  <option value="standard">Standard</option>
                  <option value="hy_mt_optimized">HY-MT Optimized</option>
                </select>
              </div>
            </div>
          )}

          <div className="pt-1 border-t border-border/50">
            <Button variant="ghost" size="sm">
              Custom Prompt...
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgentSettingsView;

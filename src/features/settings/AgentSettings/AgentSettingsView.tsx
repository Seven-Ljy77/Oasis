import React, { useState, useMemo } from "react";
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
  const updateProvider = useSettingsStore((s) => s.updateProvider);
  const deleteProvider = useSettingsStore((s) => s.deleteProvider);
  const archiveProvider = useSettingsStore((s) => s.archiveProvider);
  const testModel = useSettingsStore((s) => s.testModel);

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
                  <Button variant="ghost" size="sm" onClick={async () => {
                    const newName = prompt("New name:", p.name);
                    if (newName) await updateProvider(p.id, { ...p, name: newName });
                    loadProviders();
                  }}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={async () => {
                    const models = useSettingsStore.getState().models[p.id] ?? [];
                    if (models.length > 0) {
                      const ok = await testModel(models[0].id);
                      alert(ok ? "Connection successful" : "Connection failed");
                    } else {
                      alert("No models configured for this provider");
                    }
                  }}>Test Connection</Button>
                  <Button variant="ghost" size="sm" onClick={async () => {
                    await updateProvider(p.id, { ...p, is_default: true });
                    loadProviders();
                  }}>Set Default</Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteProvider(p.id)}>Delete</Button>
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
  const addModel = useSettingsStore((s) => s.addModel);
  const deleteModel = useSettingsStore((s) => s.deleteModel);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(
    providers[0]?.id ?? null,
  );

  // Add model form state
  const [showAdd, setShowAdd] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [newTemp, setNewTemp] = useState("0.7");
  const [newMaxTokens, setNewMaxTokens] = useState("4096");
  const [newSupportsSummary, setNewSupportsSummary] = useState(true);
  const [newSupportsTrans, setNewSupportsTrans] = useState(true);
  const [newSupportsTag, setNewSupportsTag] = useState(true);

  React.useEffect(() => {
    if (selectedProviderId) {
      loadModels(selectedProviderId);
    }
  }, [selectedProviderId, loadModels]);

  const displayModels = models[selectedProviderId ?? 0] ?? [];

  const handleAddModel = async () => {
    if (!selectedProviderId || !newModelName.trim()) return;
    await addModel(selectedProviderId, {
      model_name: newModelName.trim(),
      temperature: parseFloat(newTemp) || 0.7,
      max_tokens: parseInt(newMaxTokens) || 4096,
      is_streaming: true,
      supports_summary: newSupportsSummary,
      supports_translation: newSupportsTrans,
      supports_tagging: newSupportsTag,
    } as AgentModelProfile);
    setShowAdd(false);
    setNewModelName("");
    loadModels(selectedProviderId);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-slate-700">Models</h4>
        <Button variant="secondary" size="sm" onClick={() => setShowAdd(!showAdd)}>
          Add Model
        </Button>
      </div>

      {showAdd && selectedProviderId && (
        <div className="mb-3 p-3 border border-border rounded-lg space-y-2 bg-surface-secondary">
          <input
            placeholder="Model name (e.g. qwen3)"
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            className="w-full h-7 px-2 text-xs rounded border border-border focus:border-accent focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              placeholder="Temperature"
              value={newTemp}
              onChange={(e) => setNewTemp(e.target.value)}
              className="w-24 h-7 px-2 text-xs rounded border border-border focus:border-accent focus:outline-none"
            />
            <input
              placeholder="Max Tokens"
              value={newMaxTokens}
              onChange={(e) => setNewMaxTokens(e.target.value)}
              className="w-24 h-7 px-2 text-xs rounded border border-border focus:border-accent focus:outline-none"
            />
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" checked={newSupportsSummary} onChange={(e) => setNewSupportsSummary(e.target.checked)} className="w-3 h-3" /> Summary
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" checked={newSupportsTrans} onChange={(e) => setNewSupportsTrans(e.target.checked)} className="w-3 h-3" /> Trans
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" checked={newSupportsTag} onChange={(e) => setNewSupportsTag(e.target.checked)} className="w-3 h-3" /> Tag
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleAddModel}>Save</Button>
          </div>
        </div>
      )}

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

      {displayModels.length === 0 && (
        <p className="text-xs text-slate-400 py-4">No models configured for this provider.</p>
      )}

      <table className="w-full text-sm">
        {displayModels.length > 0 && (
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
        )}
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
                  <Button variant="ghost" size="sm" onClick={() => deleteModel(m.id)}>Delete</Button>
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
  const providers = useSettingsStore((s) => s.providers);
  const models = useSettingsStore((s) => s.models);
  const loadModels = useSettingsStore((s) => s.loadModels);
  const agentProfiles = useSettingsStore((s) => s.agentProfiles);
  const loadAgentProfile = useSettingsStore((s) => s.loadAgentProfile);
  const setAgentProfile = useSettingsStore((s) => s.setAgentProfile);

  // Collect all models from all providers
  const allModels = React.useMemo(() => {
    const result: Array<{ id: number; name: string; providerName: string }> = [];
    for (const [providerIdStr, modelList] of Object.entries(models)) {
      const providerId = Number(providerIdStr);
      const provider = providers.find((p) => p.id === providerId);
      for (const m of modelList) {
        result.push({
          id: m.id,
          name: m.model_name,
          providerName: provider?.name ?? "",
        });
      }
    }
    return result;
  }, [models, providers]);

  // Load models for all providers
  React.useEffect(() => {
    providers.forEach((p) => loadModels(p.id));
  }, [providers.length > 0 ? providers[0]?.id : null, loadModels]);

  React.useEffect(() => {
    ["summary", "translation", "tagging"].forEach(loadAgentProfile);
  }, [loadAgentProfile]);

  const agentTypes = [
    { type: "summary", label: "Summary Agent", description: "Generates article summaries" },
    { type: "translation", label: "Translation Agent", description: "Translates article content" },
    { type: "tagging", label: "Tagging Agent", description: "Auto-tags articles with relevant labels" },
  ];

  const handleSaveProfile = (agentType: string, primaryId: number | null, fallbackId: number | null) => {
    setAgentProfile({
      agent_type: agentType,
      primary_model_profile_id: primaryId,
      fallback_model_profile_id: fallbackId,
    });
  };

  const [selections, setSelections] = useState<Record<string, { primary: number | null; fallback: number | null }>>({});

  // Sync selections from loaded profiles
  React.useEffect(() => {
    const sync: Record<string, { primary: number | null; fallback: number | null }> = {};
    for (const [type, profile] of Object.entries(agentProfiles)) {
      sync[type] = {
        primary: profile.primary_model_profile_id ?? null,
        fallback: profile.fallback_model_profile_id ?? null,
      };
    }
    setSelections((prev) => ({ ...prev, ...sync }));
  }, [agentProfiles]);

  return (
    <div className="space-y-6">
      {agentTypes.map((agent) => {
        const sel = selections[agent.type] ?? { primary: null, fallback: null };

        return (
        <div key={agent.type} className="border border-border rounded-lg p-4 space-y-3">
          <div>
            <h4 className="text-sm font-medium text-slate-700">{agent.label}</h4>
            <p className="text-xs text-slate-500">{agent.description}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Primary Model</label>
            <select
              value={sel.primary ?? ""}
              onChange={(e) => {
                const v = Number(e.target.value) || null;
                setSelections((prev) => ({ ...prev, [agent.type]: { ...prev[agent.type], primary: v } }));
                handleSaveProfile(agent.type, v, sel.fallback);
              }}
              className="w-56 h-7 px-2 text-xs rounded border border-border bg-surface focus:border-accent focus:outline-none"
            >
              <option value="">Select a model...</option>
              {allModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.providerName})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fallback Model (optional)</label>
            <select
              value={sel.fallback ?? ""}
              onChange={(e) => {
                const v = Number(e.target.value) || null;
                setSelections((prev) => ({ ...prev, [agent.type]: { ...prev[agent.type], fallback: v } }));
                handleSaveProfile(agent.type, sel.primary, v);
              }}
              className="w-56 h-7 px-2 text-xs rounded border border-border bg-surface focus:border-accent focus:outline-none"
            >
              <option value="">None</option>
              {allModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.providerName})</option>
              ))}
            </select>
          </div>
        </div>
        );
      })}
    </div>
  );
};

export default AgentSettingsView;

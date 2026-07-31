import React, { useState, useMemo, useEffect } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { revealCustomTemplate, reloadPromptTemplates } from "@/lib/ipc";
import type { AgentProviderProfile, AgentModelProfile } from "@/lib/types";

type AgentTab = "providers" | "models" | "agents";

const AgentSettingsView: React.FC = () => {
  const { t } = useI18n();
  const [tab, setTab] = useState<AgentTab>("providers");

  return (
    <div className="p-4 space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5 w-fit">
        {(["providers", "models", "agents"] as AgentTab[]).map((tabValue) => (
          <button
            key={tabValue}
            onClick={() => setTab(tabValue)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              tab === tabValue
                ? "bg-surface text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tabValue === "providers" ? t.agentSettings.providers : tabValue === "models" ? t.agentSettings.models : t.agentSettings.agents}
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
  const { t } = useI18n();
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
        <h4 className="text-sm font-medium text-slate-700">{t.agentSettings.providers}</h4>
        <Button variant="secondary" size="sm" onClick={() => setShowAdd(!showAdd)}>
          {t.agentSettings.addProvider}
        </Button>
      </div>

      {showAdd && (
        <div className="mb-3 p-3 border border-border rounded-lg space-y-2 bg-surface-secondary">
          <input
            placeholder={t.agentSettings.name}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full h-7 px-2 text-xs rounded border border-border focus:border-accent focus:outline-none"
          />
          <input
            placeholder={t.agentSettings.baseUrl}
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full h-7 px-2 text-xs rounded border border-border focus:border-accent focus:outline-none"
          />
          <input
            type="password"
            placeholder={t.agentSettings.apiKey}
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="w-full h-7 px-2 text-xs rounded border border-border focus:border-accent focus:outline-none"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="primary" size="sm" onClick={handleAdd}>
              {t.common.save}
            </Button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-slate-500">
            <th className="py-2 pr-4 font-medium">{t.agentSettings.name}</th>
            <th className="py-2 pr-4 font-medium">{t.agentSettings.baseUrl}</th>
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
                  {p.is_enabled ? "Active" : t.common.disabled}
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
                    if (newName) await updateProvider(p.id, { name: newName });
                    loadProviders();
                  }}>{t.common.edit}</Button>
                  <Button variant="ghost" size="sm" onClick={async () => {
                    const models = useSettingsStore.getState().models[p.id] ?? [];
                    if (models.length > 0) {
                      const ok = await testModel(models[0].id);
                      alert(ok ? "Connection successful" : "Connection failed");
                    } else {
                      alert("No models configured for this provider");
                    }
                  }}>{t.agentSettings.testConnection}</Button>
                  <Button variant="ghost" size="sm" onClick={async () => {
                    await updateProvider(p.id, { is_default: true });
                    loadProviders();
                  }}>{t.agentSettings.setDefault}</Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteProvider(p.id)}>{t.common.delete}</Button>
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
  const { t } = useI18n();
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
        <h4 className="text-sm font-medium text-slate-700">{t.agentSettings.models}</h4>
        <Button variant="secondary" size="sm" onClick={() => setShowAdd(!showAdd)}>
          {t.agentSettings.addModel}
        </Button>
      </div>

      {showAdd && selectedProviderId && (
        <div className="mb-3 p-3 border border-border rounded-lg space-y-2 bg-surface-secondary">
          <input
            placeholder={t.agentSettings.modelName}
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            className="w-full h-7 px-2 text-xs rounded border border-border focus:border-accent focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              placeholder={t.agentSettings.temperature}
              value={newTemp}
              onChange={(e) => setNewTemp(e.target.value)}
              className="w-24 h-7 px-2 text-xs rounded border border-border focus:border-accent focus:outline-none"
            />
            <input
              placeholder={t.agentSettings.maxTokens}
              value={newMaxTokens}
              onChange={(e) => setNewMaxTokens(e.target.value)}
              className="w-24 h-7 px-2 text-xs rounded border border-border focus:border-accent focus:outline-none"
            />
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" checked={newSupportsSummary} onChange={(e) => setNewSupportsSummary(e.target.checked)} className="w-3 h-3" /> {t.agentSettings.summary}
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" checked={newSupportsTrans} onChange={(e) => setNewSupportsTrans(e.target.checked)} className="w-3 h-3" /> {t.agentSettings.translation}
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" checked={newSupportsTag} onChange={(e) => setNewSupportsTag(e.target.checked)} className="w-3 h-3" /> {t.agentSettings.tagging}
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>{t.common.cancel}</Button>
            <Button variant="primary" size="sm" onClick={handleAddModel}>{t.common.save}</Button>
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
            <th className="py-2 pr-4 font-medium">{t.agentSettings.modelName}</th>
            <th className="py-2 pr-4 font-medium">{t.agentSettings.summary}</th>
            <th className="py-2 pr-4 font-medium">{t.agentSettings.translation}</th>
            <th className="py-2 pr-4 font-medium">{t.agentSettings.tagging}</th>
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
                  <span className="text-green-600 text-xs">{t.common.enabled}</span>
                ) : (
                  <span className="text-slate-300 text-xs">{t.common.disabled}</span>
                )}
              </td>
              <td className="py-2 pr-4">
                {m.supports_translation ? (
                  <span className="text-green-600 text-xs">{t.common.enabled}</span>
                ) : (
                  <span className="text-slate-300 text-xs">{t.common.disabled}</span>
                )}
              </td>
              <td className="py-2 pr-4">
                {m.supports_tagging ? (
                  <span className="text-green-600 text-xs">{t.common.enabled}</span>
                ) : (
                  <span className="text-slate-300 text-xs">{t.common.disabled}</span>
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
                  <Button variant="ghost" size="sm" onClick={() => deleteModel(m.id)}>{t.common.delete}</Button>
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
  const { t } = useI18n();
  const providers = useSettingsStore((s) => s.providers);
  const models = useSettingsStore((s) => s.models);
  const loadModels = useSettingsStore((s) => s.loadModels);
  const agentProfiles = useSettingsStore((s) => s.agentProfiles);
  const loadAgentProfile = useSettingsStore((s) => s.loadAgentProfile);
  const setAgentProfile = useSettingsStore((s) => s.setAgentProfile);

  // Collect all models from all providers (safely handle missing data).
  const allModels = useMemo(() => {
    const result: Array<{ id: number; name: string; providerName: string }> = [];
    for (const [providerIdStr, modelList] of Object.entries(models ?? {})) {
      if (!modelList || !Array.isArray(modelList)) continue;
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

  // Load models for all providers on mount.
  useEffect(() => {
    if (providers.length > 0) {
      providers.forEach((p) => loadModels(p.id));
    }
  }, [providers, loadModels]);

  // Load agent profiles on mount.
  useEffect(() => {
    ["summary", "translation", "tagging"].forEach(loadAgentProfile);
  }, [loadAgentProfile]);

  const agentTypes = [
    { type: "summary", label: "Summary Agent", description: "Summary Agent" },
    { type: "translation", label: "Translation Agent", description: "Translation Agent" },
    { type: "tagging", label: "Tagging Agent", description: "Tagging Agent" },
  ];

  const handleSaveProfile = (agentType: string, primaryId: number | null, fallbackId: number | null) => {
    setAgentProfile({
      agent_type: agentType,
      primary_model_profile_id: primaryId,
      fallback_model_profile_id: fallbackId,
    });
  };

  const [selections, setSelections] = useState<Record<string, { primary: number | null; fallback: number | null }>>({});
  const [reloadState, setReloadState] = useState<"idle" | "loading" | "success" | "error">("idle");

  // Sync selections from loaded profiles
  useEffect(() => {
    const sync: Record<string, { primary: number | null; fallback: number | null }> = {};
    for (const [type, profile] of Object.entries(agentProfiles ?? {})) {
      if (!profile) continue;
      sync[type] = {
        primary: profile.primary_model_profile_id ?? null,
        fallback: profile.fallback_model_profile_id ?? null,
      };
    }
    setSelections((prev) => ({ ...prev, ...sync }));
  }, [agentProfiles]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400">Edit prompt files then click Reload to apply without restart.</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            setReloadState("loading");
            try { await reloadPromptTemplates(); setReloadState("success"); } catch { setReloadState("error"); }
            setTimeout(() => setReloadState("idle"), 2000);
          }}
          disabled={reloadState === "loading"}
        >
          {reloadState === "loading" ? "Reloading..." : reloadState === "success" ? "Reloaded" : reloadState === "error" ? "Failed" : "Reload Prompts"}
        </Button>
      </div>
      {agentTypes.map((agent) => {
        const sel = selections[agent.type] ?? { primary: null, fallback: null };

        return (
        <div key={agent.type} className="border border-border rounded-lg p-4 space-y-3">
          <div>
            <h4 className="text-sm font-medium text-slate-700">{agent.label}</h4>
            <p className="text-xs text-slate-500">{agent.description}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t.agentSettings.primaryModel}</label>
            <select
              value={sel.primary ?? ""}
              onChange={(e) => {
                const v = Number(e.target.value) || null;
                setSelections((prev) => ({ ...prev, [agent.type]: { ...prev[agent.type], primary: v } }));
                handleSaveProfile(agent.type, v, sel.fallback);
              }}
              className="w-56 h-7 px-2 text-xs rounded border border-border bg-surface focus:border-accent focus:outline-none"
            >
              <option value="">{t.agentSettings.primaryModel}...</option>
              {allModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.providerName})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t.agentSettings.fallbackModel}</label>
            <select
              value={sel.fallback ?? ""}
              onChange={(e) => {
                const v = Number(e.target.value) || null;
                setSelections((prev) => ({ ...prev, [agent.type]: { ...prev[agent.type], fallback: v } }));
                handleSaveProfile(agent.type, sel.primary, v);
              }}
              className="w-56 h-7 px-2 text-xs rounded border border-border bg-surface focus:border-accent focus:outline-none"
            >
              <option value="">{t.theme.none}</option>
              {allModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.providerName})</option>
              ))}
            </select>
          </div>

          <div className="pt-2 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const templateId = agent.type === "summary" ? "summary.default.yaml"
                  : agent.type === "translation" ? "translation.default.yaml"
                  : "tagging.default.yaml";
                revealCustomTemplate(templateId);
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Customize Prompt
            </Button>
          </div>
        </div>
        );
      })}
    </div>
  );
};

export default AgentSettingsView;

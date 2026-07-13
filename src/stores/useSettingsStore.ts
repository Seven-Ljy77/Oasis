// =============================================================================
// Mercury — Settings Store
// =============================================================================

import { create } from "zustand";
import type {
  AppSettings,
  AgentProviderProfile,
  AgentModelProfile,
  AgentProfile,
} from "@/lib/types";
import * as ipc from "@/lib/ipc";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface SettingsState {
  settings: AppSettings;
  settingsTab: "general" | "reader" | "agents" | "digest";
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Agent providers & models
  providers: AgentProviderProfile[];
  models: Record<number, AgentModelProfile[]>; // keyed by provider_profile_id
  agentProfiles: Record<string, AgentProfile>; // keyed by agent_type

  // --- Actions ---

  setSettingsTab: (tab: "general" | "reader" | "agents" | "digest") => void;

  // Settings
  loadSettings: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => void;

  // Providers
  loadProviders: () => Promise<void>;
  addProvider: (
    name: string,
    baseUrl: string,
    apiKey: string,
    testModel?: string,
  ) => Promise<AgentProviderProfile | null>;
  updateProvider: (
    id: number,
    updates: Partial<AgentProviderProfile>,
  ) => Promise<void>;
  deleteProvider: (id: number) => Promise<void>;
  archiveProvider: (id: number) => Promise<void>;
  unarchiveProvider: (id: number) => Promise<void>;

  // Models
  loadModels: (providerProfileId: number) => Promise<void>;
  addModel: (
    providerProfileId: number,
    model: Partial<AgentModelProfile>,
  ) => Promise<void>;
  updateModel: (
    modelProfileId: number,
    updates: Partial<AgentModelProfile>,
  ) => Promise<void>;
  deleteModel: (modelProfileId: number) => Promise<void>;
  testModel: (modelProfileId: number) => Promise<boolean>;

  // Agent Profiles
  loadAgentProfile: (agentType: string) => Promise<void>;
  setAgentProfile: (profile: AgentProfile) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const defaultSettings: AppSettings = {
  language: "en",
  sync_concurrency: 4,
  usage_retention_months: 12,
  ai_tagging_enabled: false,
};

const initialState = {
  settings: defaultSettings,
  settingsTab: "general" as const,
  isLoading: false,
  isSaving: false,
  error: null as string | null,

  providers: [] as AgentProviderProfile[],
  models: {} as Record<number, AgentModelProfile[]>,
  agentProfiles: {} as Record<string, AgentProfile>,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...initialState,

  setSettingsTab: (tab) => set({ settingsTab: tab }),

  // ---- Settings ----

  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const settings = await ipc.getSettings();
      set({ settings, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
    }
  },

  saveSettings: async (settings) => {
    set({ isSaving: true, error: null });
    try {
      await ipc.saveSettings(settings);
      set({ settings, isSaving: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isSaving: false });
    }
  },

  updateSetting: (key, value) => {
    set((s) => ({
      settings: { ...s.settings, [key]: value },
    }));
    // TODO: debounced auto-save via useAutoSave
  },

  // ---- Providers ----

  loadProviders: async () => {
    try {
      const providers = await ipc.getAgentProviders();
      set({ providers });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  addProvider: async (name, baseUrl, apiKey, testModel) => {
    try {
      const provider = await ipc.addAgentProvider(
        name,
        baseUrl,
        apiKey,
        testModel,
      );
      set((s) => ({ providers: [...s.providers, provider] }));
      return provider;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      return null;
    }
  },

  updateProvider: async (id, updates) => {
    try {
      const updated = await ipc.updateAgentProvider(id, updates);
      set((s) => ({
        providers: s.providers.map((p) => (p.id === id ? updated : p)),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  deleteProvider: async (id) => {
    try {
      await ipc.deleteAgentProvider(id);
      set((s) => ({
        providers: s.providers.filter((p) => p.id !== id),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  archiveProvider: async (id) => {
    try {
      await ipc.archiveAgentProvider(id);
      set((s) => ({
        providers: s.providers.map((p) =>
          p.id === id
            ? { ...p, is_archived: true, archived_at: new Date().toISOString() }
            : p,
        ),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  unarchiveProvider: async (id) => {
    try {
      await ipc.unarchiveAgentProvider(id);
      set((s) => ({
        providers: s.providers.map((p) =>
          p.id === id
            ? { ...p, is_archived: false, archived_at: null }
            : p,
        ),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  // ---- Models ----

  loadModels: async (providerProfileId) => {
    try {
      const models = await ipc.getAgentModels(providerProfileId);
      set((s) => ({
        models: { ...s.models, [providerProfileId]: models },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  addModel: async (providerProfileId, model) => {
    try {
      const created = await ipc.addAgentModel(providerProfileId, model);
      set((s) => ({
        models: {
          ...s.models,
          [providerProfileId]: [
            ...(s.models[providerProfileId] || []),
            created,
          ],
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  updateModel: async (modelProfileId, updates) => {
    try {
      const updated = await ipc.updateAgentModel(modelProfileId, updates);
      set((s) => {
        const nextModels = { ...s.models };
        for (const key of Object.keys(nextModels)) {
          const k = Number(key);
          nextModels[k] = nextModels[k].map((m) =>
            m.id === modelProfileId ? updated : m,
          );
        }
        return { models: nextModels };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  deleteModel: async (modelProfileId) => {
    try {
      await ipc.deleteAgentModel(modelProfileId);
      set((s) => {
        const nextModels = { ...s.models };
        for (const key of Object.keys(nextModels)) {
          const k = Number(key);
          nextModels[k] = nextModels[k].filter(
            (m) => m.id !== modelProfileId,
          );
        }
        return { models: nextModels };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  testModel: async (modelProfileId) => {
    try {
      const ok = await ipc.testAgentModel(modelProfileId);
      return ok;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      return false;
    }
  },

  // ---- Agent Profiles ----

  loadAgentProfile: async (agentType) => {
    try {
      const profile = await ipc.getAgentProfile(agentType);
      set((s) => ({
        agentProfiles: { ...s.agentProfiles, [agentType]: profile },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  setAgentProfile: async (profile) => {
    try {
      await ipc.setAgentProfile(profile);
      set((s) => ({
        agentProfiles: {
          ...s.agentProfiles,
          [profile.agent_type]: profile,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },
}));

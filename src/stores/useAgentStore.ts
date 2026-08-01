// =============================================================================
// Mercury — Agent Store
// =============================================================================

import { create } from "zustand";
import type {
  AgentStateSnapshot,
  AgentTaskKind,
  AgentRunPhase,
} from "@/lib/types";
import * as ipc from "@/lib/ipc";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface AgentState {
  agentState: AgentStateSnapshot;
  availability: Record<AgentTaskKind, boolean>;
  isLoading: boolean;
  error: string | null;

  // Actions
  checkAvailability: () => Promise<void>;
  startAgentTask: (
    entryId: number,
    taskKind: AgentTaskKind,
    targetLanguage?: string,
    detailLevel?: string,
  ) => Promise<string | null>; // returns task_id or null
  startBatchTagging: (entryIds: number[]) => Promise<string | null>;
  cancelTask: (taskId: string) => Promise<void>;
  refreshAgentState: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState = {
  agentState: {
    active_runs: [],
    waiting_count: 0,
  } as AgentStateSnapshot,
  availability: {} as Record<AgentTaskKind, boolean>,
  isLoading: false,
  error: null as string | null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAgentStore = create<AgentState>()((set, get) => ({
  ...initialState,

  checkAvailability: async () => {
    set({ isLoading: true, error: null });
    try {
      const availability = await ipc.checkAgentAvailability();
      set({ availability, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, isLoading: false });
    }
  },

  startAgentTask: async (entryId, taskKind, targetLanguage, detailLevel) => {
    try {
      const { task_id } = await ipc.startAgentTask(
        entryId,
        taskKind,
        targetLanguage,
        detailLevel,
      );
      // Optimistically add to local state
      set((s) => ({
        agentState: {
          ...s.agentState,
          active_runs: [
            ...s.agentState.active_runs,
            {
              task_id,
              entry_id: entryId,
              task_kind: taskKind,
              phase: "waiting" as AgentRunPhase,
              status_text: null,
              progress: null,
            },
          ],
        },
      }));
      return task_id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      return null;
    }
  },

  startBatchTagging: async (entryIds) => {
    try {
      const { task_id } = await ipc.startBatchTagging(entryIds);
      return task_id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      return null;
    }
  },

  cancelTask: async (taskId) => {
    try {
      await ipc.cancelAgentTask(taskId);
      set((s) => ({
        agentState: {
          ...s.agentState,
          active_runs: s.agentState.active_runs.filter(
            (r) => r.task_id !== taskId,
          ),
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },

  refreshAgentState: async () => {
    try {
      const state = await ipc.getAgentState();
      set({ agentState: state });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
    }
  },
}));

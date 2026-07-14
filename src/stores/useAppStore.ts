// =============================================================================
// Mercury — App Store (global UI state)
// =============================================================================

import { create } from "zustand";
import type {
  SidebarSection,
  FeedSelection,
  ReadingMode,
  BootstrapState,
  SyncState,
  AgentStateSnapshot,
} from "@/lib/types";

/** Kinds of overlay sheets the app can display. */
export type SheetKind =
  | "appSettings"
  | "feedEditor"
  | "importOPML"
  | "tagLibrary"
  | "batchTagging"
  | "shareDigest"
  | "exportDigest"
  | "exportMultipleDigest"
  | "tagRename"
  | "tagMerge"
  | null;

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface AppState {
  // Bootstrap & lifecycle
  isReady: boolean;
  bootstrapState: BootstrapState;

  // Sync
  syncState: SyncState;

  // Sidebar navigation
  sidebarSection: SidebarSection;

  // Selection
  selectedFeedSelection: FeedSelection;
  selectedEntryId: number | null;

  // Reading mode (article / summary / translation / digest)
  readingMode: ReadingMode;

  // Entry list filters
  showUnreadOnly: boolean;
  searchText: string;
  selectedTagIds: number[];
  tagMatchMode: "any" | "all";

  // Counts (populated by backend events)
  totalUnread: number;
  feedCount: number;
  entryCount: number;
  lastSyncAt: string | null;

  // Agent status (periodically refreshed)
  agentState: AgentStateSnapshot;
  agentAvailability: Record<string, boolean>;

  // Sheets
  activeSheet: SheetKind;
  openSheet: (sheet: SheetKind) => void;
  closeSheet: () => void;

  // Tag rename target (set before opening tagRename sheet)
  renameTargetTagId: number | null;
  renameTargetTagName: string | null;
  setRenameTargetTagId: (id: number | null) => void;
  setRenameTargetTagName: (name: string | null) => void;

  // Tag merge target (set before opening tagMerge sheet)
  mergeSourceTagId: number | null;
  mergeSourceTagName: string | null;
  setMergeSourceTagId: (id: number | null) => void;
  setMergeSourceTagName: (name: string | null) => void;

  // Multi-select
  multiSelectMode: boolean;
  selectedEntryIds: Set<number>;
  toggleSelectEntry: (id: number) => void;
  selectAllEntries: (ids: number[]) => void;
  clearSelection: () => void;
  enterMultiSelect: () => void;
  exitMultiSelect: () => void;

  // Font scaling (Ctrl+= / Ctrl+-)
  fontScale: number;
  increaseFontScale: () => void;
  decreaseFontScale: () => void;
  resetFontScale: () => void;

  // Search panel
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // --------------------------------------------------
  // Actions
  // --------------------------------------------------

  bootstrap: () => void;
  setBootstrapError: (error: string) => void;

  // Sync
  setSyncState: (state: Partial<SyncState>) => void;

  // Sidebar
  switchSection: (section: SidebarSection) => void;

  // Selection
  selectFeed: (selection: FeedSelection) => void;
  selectEntry: (entryId: number | null) => void;

  // Reading mode
  setReadingMode: (mode: ReadingMode) => void;

  // Filters
  toggleUnreadOnly: () => void;
  setSearchText: (text: string) => void;
  setSelectedTagIds: (ids: number[]) => void;
  setTagMatchMode: (mode: "any" | "all") => void;

  // Counts
  setTotalUnread: (count: number) => void;
  setFeedCount: (count: number) => void;
  setEntryCount: (count: number) => void;
  setLastSyncAt: (iso: string | null) => void;

  // Agent
  setAgentState: (state: AgentStateSnapshot) => void;
  setAgentAvailability: (availability: Record<string, boolean>) => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState = {
  isReady: false,
  bootstrapState: { phase: "loading" as const, error: null },

  syncState: {
    phase: "idle" as const,
    message: null,
    started_at: null,
  },

  sidebarSection: "feeds" as SidebarSection,

  selectedFeedSelection: { type: "all" as const },
  selectedEntryId: null as number | null,

  readingMode: "reader" as ReadingMode,

  showUnreadOnly: false,
  searchText: "",
  selectedTagIds: [] as number[],
  tagMatchMode: "any" as "any" | "all",

  totalUnread: 0,
  feedCount: 0,
  entryCount: 0,
  lastSyncAt: null as string | null,

  agentState: {
    active_runs: [],
    waiting_count: 0,
  },
  agentAvailability: {},

  // Sheets
  activeSheet: null as SheetKind,
  openSheet: () => {},     // placeholder — replaced in create()
  closeSheet: () => {},    // placeholder — replaced in create()

  // Tag rename target
  renameTargetTagId: null as number | null,
  renameTargetTagName: null as string | null,
  setRenameTargetTagId: () => {},   // placeholder
  setRenameTargetTagName: () => {}, // placeholder

  // Tag merge target
  mergeSourceTagId: null as number | null,
  mergeSourceTagName: null as string | null,
  setMergeSourceTagId: () => {},    // placeholder
  setMergeSourceTagName: () => {},  // placeholder

  // Multi-select
  multiSelectMode: false,
  selectedEntryIds: new Set<number>(),
  toggleSelectEntry: () => {},  // placeholder
  selectAllEntries: () => {},   // placeholder
  clearSelection: () => {},     // placeholder
  enterMultiSelect: () => {},   // placeholder
  exitMultiSelect: () => {},    // placeholder

  // Font scaling
  fontScale: 1,
  increaseFontScale: () => {},  // placeholder
  decreaseFontScale: () => {},  // placeholder
  resetFontScale: () => {},     // placeholder

  // Search panel
  searchOpen: false,
  setSearchOpen: () => {},      // placeholder
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAppStore = create<AppState>()((set, get) => ({
  ...initialState,

  // Bootstrap
  bootstrap: () =>
    set({
      isReady: true,
      bootstrapState: { phase: "ready", error: null },
    }),

  setBootstrapError: (error: string) =>
    set({ bootstrapState: { phase: "error", error } }),

  // Sync
  setSyncState: (partial) =>
    set((s) => ({ syncState: { ...s.syncState, ...partial } })),

  // Sidebar
  switchSection: (section) => set({ sidebarSection: section }),

  // Selection
  selectFeed: (selection) => {
    set({
      selectedFeedSelection: selection,
      selectedEntryId: null,
      // TODO: trigger entry list reload for new selection
    });
  },

  selectEntry: (entryId) => {
    set({ selectedEntryId: entryId });
    // TODO: if entryId is non-null, fetch reader content
  },

  // Reading mode
  setReadingMode: (mode) => set({ readingMode: mode }),

  // Filters
  toggleUnreadOnly: () =>
    set((s) => ({ showUnreadOnly: !s.showUnreadOnly })),

  setSearchText: (text) => set({ searchText: text }),

  setSelectedTagIds: (ids) => set({ selectedTagIds: ids }),

  setTagMatchMode: (mode) => set({ tagMatchMode: mode }),

  // Counts
  setTotalUnread: (count) => set({ totalUnread: count }),
  setFeedCount: (count) => set({ feedCount: count }),
  setEntryCount: (count) => set({ entryCount: count }),
  setLastSyncAt: (iso) => set({ lastSyncAt: iso }),

  // Agent
  setAgentState: (state) => set({ agentState: state }),
  setAgentAvailability: (availability) =>
    set({ agentAvailability: availability }),

  // Sheets
  openSheet: (sheet) => set({ activeSheet: sheet }),
  closeSheet: () => set({ activeSheet: null }),

  // Tag rename target
  setRenameTargetTagId: (id) => set({ renameTargetTagId: id }),
  setRenameTargetTagName: (name) => set({ renameTargetTagName: name }),

  // Tag merge target
  setMergeSourceTagId: (id) => set({ mergeSourceTagId: id }),
  setMergeSourceTagName: (name) => set({ mergeSourceTagName: name }),

  // Multi-select
  toggleSelectEntry: (id) =>
    set((s) => {
      const next = new Set(s.selectedEntryIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedEntryIds: next };
    }),
  selectAllEntries: (ids) =>
    set({ selectedEntryIds: new Set(ids) }),
  clearSelection: () =>
    set({ selectedEntryIds: new Set() }),
  enterMultiSelect: () =>
    set({ multiSelectMode: true, selectedEntryIds: new Set() }),
  exitMultiSelect: () =>
    set({ multiSelectMode: false, selectedEntryIds: new Set() }),

  // Font scaling
  increaseFontScale: () =>
    set((s) => ({ fontScale: Math.min(s.fontScale + 0.1, 2.0) })),
  decreaseFontScale: () =>
    set((s) => ({ fontScale: Math.max(s.fontScale - 0.1, 0.5) })),
  resetFontScale: () => set({ fontScale: 1 }),

  // Search
  setSearchOpen: (searchOpen) => set({ searchOpen }),
}));

export interface BatchTagConfig { scope?: string; concurrency: number; skipAlreadyTagged: boolean; skipAlreadyApplied: boolean; }

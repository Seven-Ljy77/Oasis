// =============================================================================
// Mercury — IPC Wrappers
//
// Every Tauri backend command is wrapped in a typed function so components
// never call `invoke()` directly.
// =============================================================================

import { invoke } from "@tauri-apps/api/core";
import type {
  Feed,
  EntryListQuery,
  EntryPage,
  EntryListItem,
  PageCursor,
  AgentProviderProfile,
  AgentModelProfile,
  AgentProfile,
  AgentStateSnapshot,
  AgentTaskKind,
  SummaryResult,
  TranslationSegmentData,
  TagInfo,
  TagLibraryItem,
  TagSuggestion,
  UsageReportSnapshot,
  AppSettings,
  ThemePreset,
  ThemeMode,
  LogEntry,
  UploadLogsResponse,
} from "./types";

// ---------------------------------------------------------------------------
// Feed commands
// ---------------------------------------------------------------------------

export const addFeed = (url: string, title?: string): Promise<Feed> =>
  invoke<Feed>("add_feed", { url, title });

export const probeFeed = (url: string): Promise<{ title: string | null; site_url: string | null; entry_count: number }> =>
  invoke("probe_feed", { url });

export const updateFeed = (
  id: number,
  url: string,
  title?: string,
): Promise<Feed> => invoke<Feed>("update_feed", { id, url, title });

export const deleteFeed = (id: number): Promise<void> =>
  invoke<void>("delete_feed", { id });

export const syncFeeds = (concurrency?: number): Promise<void> =>
  invoke<void>("sync_feeds", { concurrency });

export const importOpml = (
  path: string,
  replace: boolean,
  forceSiteName: boolean,
  concurrency?: number,
): Promise<import("./types").ImportResult> =>
  invoke("import_opml", { path, replace, forceSiteName, concurrency });

export const exportOpml = (path: string): Promise<void> =>
  invoke<void>("export_opml", { path });

export const getSidebarProjection = (): Promise<import("./types").SidebarProjection> =>
  invoke("get_sidebar_projection");

export const getFeeds = (): Promise<Feed[]> =>
  invoke<Feed[]>("get_feeds", {});

// ---------------------------------------------------------------------------
// Entry commands
// ---------------------------------------------------------------------------

export const loadEntries = (query: EntryListQuery): Promise<EntryPage> =>
  invoke<EntryPage>("load_entries", { query });

export const loadNextEntries = (
  query: EntryListQuery,
  cursor: PageCursor,
): Promise<EntryPage> =>
  invoke<EntryPage>("load_next_entries", {
    query: { ...query, cursor },
  });

export const markRead = (
  entryIds: number[],
  isRead: boolean,
): Promise<void> => invoke<void>("mark_read", { entryIds, isRead });

export const markAllRead = (
  query: import("./types").EntryListQuery,
  isRead: boolean,
): Promise<number> => invoke<number>("mark_all_read", { query, isRead });

export const deleteAllEntries = (
  query: import("./types").EntryListQuery,
): Promise<number> => invoke<number>("delete_all_entries", { query });

export const markStarred = (
  entryId: number,
  isStarred: boolean,
): Promise<void> => invoke<void>("mark_starred", { entryId, isStarred });

export const deleteEntry = (entryId: number): Promise<void> =>
  invoke<void>("delete_entry", { entryId });

export const searchEntries = (
  text: string,
  scope?: string,
): Promise<EntryListItem[]> =>
  invoke<EntryListItem[]>("search_entries", { text, scope });

// ---------------------------------------------------------------------------
// Reader commands
// ---------------------------------------------------------------------------

export const buildReaderHTML = (
  entryUrl: string,
  entryId?: number,
  theme?: {
    themePreset: ThemePreset;
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    contentWidth: number;
    quickStyle: string;
    themeMode: ThemeMode;
  },
): Promise<{ html: string; theme_fingerprint: string }> =>
  invoke("build_reader_html", { entryUrl, entryId, theme });

// ---------------------------------------------------------------------------
// Agent commands
// ---------------------------------------------------------------------------

export const getAgentProviders = (): Promise<AgentProviderProfile[]> =>
  invoke<AgentProviderProfile[]>("get_agent_providers", {});

export const addAgentProvider = (
  name: string,
  baseUrl: string,
  apiKey: string,
  testModel?: string,
): Promise<AgentProviderProfile> =>
  invoke<AgentProviderProfile>("add_agent_provider", {
    name,
    baseUrl,
    apiKey,
    testModel,
  });

export const updateAgentProvider = (
  id: number,
  updates: Partial<AgentProviderProfile>,
): Promise<AgentProviderProfile> =>
  invoke<AgentProviderProfile>("update_agent_provider", {
    providerProfileId: id,
    updates,
  });

export const deleteAgentProvider = (id: number): Promise<void> =>
  invoke<void>("delete_agent_provider", { providerProfileId: id });

export const archiveAgentProvider = (id: number): Promise<void> =>
  invoke<void>("archive_agent_provider", { providerProfileId: id });

export const unarchiveAgentProvider = (id: number): Promise<void> =>
  invoke<void>("unarchive_agent_provider", { providerProfileId: id });

export const getAgentModels = (
  providerProfileId: number,
): Promise<AgentModelProfile[]> =>
  invoke<AgentModelProfile[]>("get_agent_models", { providerProfileId });

export const addAgentModel = (
  providerProfileId: number,
  model: Partial<AgentModelProfile>,
): Promise<AgentModelProfile> =>
  invoke<AgentModelProfile>("add_agent_model", { providerProfileId, model });

export const updateAgentModel = (
  modelProfileId: number,
  updates: Partial<AgentModelProfile>,
): Promise<AgentModelProfile> =>
  invoke<AgentModelProfile>("update_agent_model", { modelProfileId, updates });

export const deleteAgentModel = (modelProfileId: number): Promise<void> =>
  invoke<void>("delete_agent_model", { modelProfileId });

export const testAgentModel = (modelProfileId: number): Promise<boolean> =>
  invoke<boolean>("test_agent_model", { modelProfileId });

export const getAgentProfile = (
  agentType: string,
): Promise<AgentProfile> =>
  invoke<AgentProfile>("get_agent_profile", { agentType });

export const setAgentProfile = (profile: AgentProfile): Promise<void> =>
  invoke<void>("set_agent_profile", { profile });

// ---------------------------------------------------------------------------
// Agent — Task dispatch
// ---------------------------------------------------------------------------

export const startAgentTask = (
  entryId: number,
  taskKind: AgentTaskKind,
  targetLanguage?: string,
  detailLevel?: string,
): Promise<{ task_id: string }> =>
  invoke<{ task_id: string }>("start_agent_task", {
    entryId,
    taskKind,
    targetLanguage,
    detailLevel,
  });

export const startBatchTagging = (
  entryIds: number[],
): Promise<{ task_id: string }> =>
  invoke<number>("start_batch_tagging", {
    entryIds,
    scopeLabel: null,
    concurrency: 3,
    skipAlreadyApplied: true,
    skipAlreadyTagged: false,
  }).then((runId) => ({ task_id: String(runId) }));

export const cancelAgentTask = (taskId: string): Promise<void> =>
  invoke<void>("cancel_agent_task", { taskId });

export const getAgentState = (): Promise<AgentStateSnapshot> =>
  invoke<AgentStateSnapshot>("get_agent_state", {});

export const checkAgentAvailability = (): Promise<
  Record<AgentTaskKind, boolean>
> => invoke<Record<AgentTaskKind, boolean>>("check_agent_availability", {});

// ---------------------------------------------------------------------------
// Summary commands
// ---------------------------------------------------------------------------

export const getSummary = (
  entryId: number,
  targetLanguage: string,
  detailLevel: string,
): Promise<SummaryResult | null> =>
  invoke<SummaryResult | null>("get_summary", {
    entryId,
    targetLanguage,
    detailLevel,
  });

export const generateSummary = (
  entryId: number,
  targetLanguage: string,
  detailLevel: string,
  requestId: string,
  force: boolean,
): Promise<{ task_id: string; text: string; html: string; result?: SummaryResult }> =>
  invoke<{ task_id: string; text: string; html: string; result?: SummaryResult }>("generate_summary", {
    entryId,
    targetLanguage,
    detailLevel,
    requestId,
    force,
  });

// ---------------------------------------------------------------------------
// Translation commands
// ---------------------------------------------------------------------------

export const getTranslationSegments = (
  entryId: number,
  targetLanguage: string,
): Promise<TranslationSegmentData[]> =>
  invoke<TranslationSegmentData[]>("get_translation_segments", {
    entryId,
    targetLanguage,
  });

export const startTranslation = (
  entryId: number,
  targetLanguage: string,
  concurrency: number,
  requestId: string,
): Promise<{
  total_segments: number;
  segments: TranslationSegmentData[];
  error: string | null;
}> =>
  invoke("start_translation", {
    entryId,
    targetLanguage,
    concurrency,
    requestId,
  });

export const buildTranslationHTML = (
  entryId: number,
  targetLanguage: string,
  bilingual?: boolean,
): Promise<string> =>
  invoke<string>("build_translation_html", { entryId, targetLanguage, bilingual });

// ---------------------------------------------------------------------------
// Tag commands
// ---------------------------------------------------------------------------

export const getTags = (): Promise<TagInfo[]> =>
  invoke<TagInfo[]>("get_tags", {});

export const getTagLibrary = (): Promise<TagLibraryItem[]> =>
  invoke<TagLibraryItem[]>("get_tag_library", {});

export const createTag = (
  name: string,
  isProvisional?: boolean,
): Promise<TagInfo> =>
  invoke<TagInfo>("create_tag", { name, isProvisional });

export const assignTag = (entryId: number, tagId: number): Promise<void> =>
  invoke<void>("assign_tag", { entryId, tagId });

export const removeTag = (entryId: number, tagId: number): Promise<void> =>
  invoke<void>("remove_tag", { entryId, tagId });

export const renameTag = (tagId: number, newName: string): Promise<TagInfo> =>
  invoke<TagInfo>("rename_tag", { tagId, newName });

export const mergeTag = (
  sourceTagId: number,
  targetTagId: number,
): Promise<void> =>
  invoke<void>("merge_tag", { sourceTagId, targetTagId });

export const deleteTag = (tagId: number): Promise<void> =>
  invoke<void>("delete_tag", { tagId });

export const cleanupEmptyTags = (): Promise<number> =>
  invoke<number>("cleanup_empty_tags");

export const deleteTagsBatch = (tagIds: number[]): Promise<number> =>
  invoke<number>("delete_tags_batch", { tagIds });

export const deleteUnusedTags = (): Promise<number> =>
  invoke<number>("delete_unused_tags");

export const recalculateTagCounts = (): Promise<void> =>
  invoke("recalculate_tag_counts");

export const suggestTags = (entryId: number): Promise<TagSuggestion[]> =>
  invoke<TagSuggestion[]>("suggest_tags", { entryId });

export const getTagsForEntry = (entryId: number): Promise<TagInfo[]> =>
  invoke<TagInfo[]>("get_tags_for_entry", { entryId });

// ---------------------------------------------------------------------------
// Digest commands
// ---------------------------------------------------------------------------

export const shareDigest = (entryId: number): Promise<string> =>
  invoke<string>("share_digest", { entryId });

export const exportDigest = (entryId: number, path: string): Promise<void> =>
  invoke<void>("export_digest", { entryId, path });

export const exportMultipleDigest = (entryIds: number[], path: string): Promise<void> =>
  invoke<void>("export_multiple_digest", { entryIds, path });

export const exportArticles = (entryIds: number[], path: string): Promise<void> =>
  invoke<void>("export_articles", { entryIds, path });

export const revealCustomTemplate = (templateId: string): Promise<void> =>
  invoke<void>("reveal_custom_template", { templateId });

// ---------------------------------------------------------------------------
// Usage / Analytics commands
// ---------------------------------------------------------------------------

export const getUsageReport = (
  days?: number,
): Promise<UsageReportSnapshot> =>
  invoke<UsageReportSnapshot>("get_usage_report", { days });

// ---------------------------------------------------------------------------
// Settings commands
// ---------------------------------------------------------------------------

export const getSettings = (): Promise<AppSettings> =>
  invoke<AppSettings>("get_settings", {});

export const saveSettings = (settings: AppSettings): Promise<void> =>
  invoke<void>("save_settings", { settings });

// ---------------------------------------------------------------------------
// Window / Shell commands
// ---------------------------------------------------------------------------

export const openInBrowser = (url: string): Promise<void> =>
  invoke<void>("open_in_browser", { url });

// ---------------------------------------------------------------------------
// Note commands
// ---------------------------------------------------------------------------

export const getNote = (entryId: number): Promise<{ text: string } | null> =>
  invoke<{ text: string } | null>("get_note", { entryId });

export const saveNote = (entryId: number, text: string): Promise<void> =>
  invoke<void>("save_note", { entryId, text });

// ---------------------------------------------------------------------------
// Log commands
// ---------------------------------------------------------------------------

export const getLogs = (): Promise<LogEntry[]> =>
  invoke<LogEntry[]>("get_logs", {});

export const uploadLogs = (): Promise<UploadLogsResponse> =>
  invoke<UploadLogsResponse>("upload_logs", {});

export const clearLogs = (): Promise<void> =>
  invoke<void>("clear_logs", {});

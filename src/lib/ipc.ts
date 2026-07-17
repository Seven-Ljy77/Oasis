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
  DigestSingleEntryProjection,
  UsageReportSnapshot,
  AppSettings,
  ThemePreset,
  ThemeMode,
  ThemeTokens,
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
): Promise<void> =>
  invoke<void>("import_opml", { path, replace, forceSiteName });

export const exportOpml = (path: string): Promise<void> =>
  invoke<void>("export_opml", { path });

export const getFeeds = (): Promise<Feed[]> =>
  invoke<Feed[]>("get_feeds", {});

// ---------------------------------------------------------------------------
// Entry commands
// ---------------------------------------------------------------------------

export const loadEntries = (query: EntryListQuery): Promise<EntryPage> =>
  invoke<EntryPage>("load_entries", { query });

export const loadNextEntries = (cursor: PageCursor): Promise<EntryPage> =>
  invoke<EntryPage>("load_next_entries", { cursor });

export const markRead = (
  entryIds: number[],
  isRead: boolean,
): Promise<void> => invoke<void>("mark_read", { entryIds, isRead });

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

export const getEntryContent = (
  entryId: number,
): Promise<{ html: string; title: string | null; published_at: string | null; author: string | null; feed_title: string | null }> =>
  invoke("get_entry_content", { entryId });

// ---------------------------------------------------------------------------
// Reader commands
// ---------------------------------------------------------------------------

export const buildReaderHTML = (entryUrl: string): Promise<{ html: string; theme_fingerprint: string }> =>
  invoke("build_reader_html", { entryUrl });

export const getThemeTokens = (preset: ThemePreset): Promise<ThemeTokens> =>
  invoke<ThemeTokens>("get_theme_tokens", { preset });

export const updateThemeTokens = (
  preset: ThemePreset,
  tokens: Partial<ThemeTokens>,
): Promise<ThemeTokens> =>
  invoke<ThemeTokens>("update_theme_tokens", { preset, tokens });

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
  invoke<{ task_id: string }>("start_batch_tagging", { entryIds });

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

export const getSummary = (entryId: number): Promise<SummaryResult | null> =>
  invoke<SummaryResult | null>("get_summary", { entryId });

export const generateSummary = (
  entryId: number,
  detailLevel?: string,
): Promise<{ task_id: string }> =>
  invoke<{ task_id: string }>("generate_summary", { entryId, detailLevel });

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
  concurrency?: number,
): Promise<{ task_id: string }> =>
  invoke<{ task_id: string }>("start_translation", { entryId, targetLanguage, concurrency });

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

export const getDigestEntries = (
  feedIds?: number[],
  dateRange?: { start: string; end: string },
): Promise<DigestSingleEntryProjection[]> =>
  invoke<DigestSingleEntryProjection[]>("get_digest_entries", {
    feedIds,
    dateRange,
  });

export const prepareDigest = (
  entries: DigestSingleEntryProjection[],
  options?: { style?: string; maxLength?: number },
): Promise<{ html: string }> =>
  invoke<{ html: string }>("prepare_digest", { entries, options });

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

export const openWindow = (label: string, url: string): Promise<void> =>
  invoke<void>("open_window", { label, url });

export const closeWindow = (label: string): Promise<void> =>
  invoke<void>("close_window", { label });

export const focusWindow = (label: string): Promise<void> =>
  invoke<void>("focus_window", { label });

export const openInBrowser = (url: string): Promise<void> =>
  invoke<void>("open_in_browser", { url });

// ---------------------------------------------------------------------------
// Note commands
// ---------------------------------------------------------------------------

export const getNote = (entryId: number): Promise<{ text: string } | null> =>
  invoke<{ text: string } | null>("get_note", { entryId });

export const saveNote = (entryId: number, text: string): Promise<void> =>
  invoke<void>("save_note", { entryId, text });

// =============================================================================
// Mercury — Shared TypeScript interfaces & types
// =============================================================================

// -----------------------------------------------------------------------------
// Feed
// -----------------------------------------------------------------------------

export interface Feed {
  id: number;
  title: string | null;
  feed_url: string;
  site_url: string | null;
  feed_parser_version: number | null;
  last_fetched_at: string | null; // ISO 8601
  created_at: string; // ISO 8601
  unread_count?: number;
}

export interface FeedSelection {
  type: "all" | "starred" | "feed";
  feedId?: number;
}

// -----------------------------------------------------------------------------
// Entry
// -----------------------------------------------------------------------------

export interface EntryListItem {
  id: number;
  feed_id: number;
  title: string | null;
  author: string | null;
  url: string | null;
  published_at: string | null; // ISO 8601
  summary: string | null;
  is_read: boolean;
  is_starred: boolean;
  feed_title: string | null;
  created_at: string; // ISO 8601
}

export interface EntryListQuery {
  feed_id?: number;
  unread_only?: boolean;
  starred_only?: boolean;
  tag_ids?: number[];
  tag_match_mode?: "any" | "all";
  search_text?: string;
  cursor?: PageCursor;
  limit?: number;
}

export interface PageCursor {
  published_at: string;
  created_at: string;
  id: number;
}

export interface EntryPage {
  entries: EntryListItem[];
  next_cursor: PageCursor | null;
}

// -----------------------------------------------------------------------------
// Agent — Provider & Model Profiles
// -----------------------------------------------------------------------------

export interface AgentProviderProfile {
  id: number;
  name: string;
  base_url: string;
  api_key_ref: string;
  test_model: string | null;
  is_default: boolean;
  is_enabled: boolean;
  is_archived: boolean;
  archived_at: string | null; // ISO 8601
  created_at: string; // ISO 8601
}

export interface AgentModelProfile {
  id: number;
  provider_profile_id: number;
  model_name: string;
  temperature: number | null;
  top_p: number | null;
  max_tokens: number | null;
  is_streaming: boolean;
  supports_summary: boolean;
  supports_translation: boolean;
  supports_tagging: boolean;
  is_default: boolean;
  is_enabled: boolean;
  is_archived: boolean;
  archived_at: string | null; // ISO 8601
  last_tested_at: string | null; // ISO 8601
  created_at: string; // ISO 8601
}

export interface AgentProfile {
  agent_type: string;
  primary_model_profile_id: number | null;
  fallback_model_profile_id: number | null;
}

// -----------------------------------------------------------------------------
// Agent — Run State
// -----------------------------------------------------------------------------

export type AgentTaskKind =
  | "summary"
  | "translation"
  | "tagging"
  | "tagging_batch";

export type AgentRunPhase =
  | "idle"
  | "waiting"
  | "requesting"
  | "generating"
  | "persisting"
  | "completed"
  | "failed"
  | "timed_out"
  | "cancelled";

export interface AgentStateSnapshot {
  active_runs: AgentRunState[];
  waiting_count: number;
}

export interface AgentRunState {
  task_id: string;
  entry_id: number;
  task_kind: AgentTaskKind;
  phase: AgentRunPhase;
  status_text: string | null;
  progress: { completed: number; total: number } | null;
}

// -----------------------------------------------------------------------------
// Summary & Translation
// -----------------------------------------------------------------------------

export interface SummaryResult {
  id: number;
  task_run_id: number;
  entry_id: number;
  target_language: string;
  detail_level: string;
  text: string;
  created_at: string; // ISO 8601
}

export interface TranslationSegmentData {
  segment_id: string;
  source_text: string;
  translated_text: string | null;
  order_index: number;
  status: "pending" | "completed" | "failed";
}

// -----------------------------------------------------------------------------
// Tags
// -----------------------------------------------------------------------------

export interface TagInfo {
  id: number;
  name: string;
  normalized_name: string;
  is_provisional: boolean;
  usage_count: number;
}

export interface TagLibraryItem extends TagInfo {
  alias_count: number;
  is_duplicate: boolean;
}

export interface TagSuggestion {
  name: string;
  source: "ai" | "nlp" | "existing" | "error";
  tag_id?: number;
}

// -----------------------------------------------------------------------------
// Digest
// -----------------------------------------------------------------------------

export interface DigestSingleEntryProjection {
  article_title: string;
  article_author: string | null;
  article_url: string;
  digest_title: string;
}

// -----------------------------------------------------------------------------
// Reader Theme
// -----------------------------------------------------------------------------

export type ThemePreset = "classic" | "paper";

export type ThemeMode = "auto" | "eyecare" | "forceLight" | "forceDark";

export interface ThemeTokens {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  contentMaxWidth: number;
  backgroundColor: string;
  textPrimaryColor: string;
  textSecondaryColor: string;
  linkColor: string;
  blockquoteBorderColor: string;
  codeBackgroundColor: string;
  paragraphSpacing: number;
  headingScale: number;
  codeBlockRadius: number;
}

// -----------------------------------------------------------------------------
// Usage / Analytics
// -----------------------------------------------------------------------------

export interface UsageReportSnapshot {
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  successful_requests: number;
  failed_requests: number;
  by_provider: ProviderBreakdown[];
  by_model: ModelBreakdown[];
  by_agent_kind: AgentKindBreakdown[];
}

export interface ProviderBreakdown {
  provider_name: string;
  requests: number;
  tokens: number;
}

export interface ModelBreakdown {
  model_name: string;
  requests: number;
  tokens: number;
}

export interface AgentKindBreakdown {
  agent_kind: string;
  requests: number;
  tokens: number;
}

export interface DailyBucket {
  date: string; // "YYYY-MM-DD"
  prompt_tokens: number;
  completion_tokens: number;
  total_requests: number;
  succeeded: number;
  failed: number;
}

export interface UsageSummary {
  total_tokens: number;
  total_requests: number;
}

export interface QualityMetrics {
  success_rate: number;
  coverage_rate: number;
  avg_tokens_per_request: number;
}

export interface PeriodComparison {
  tokens_delta: number;
  tokens_delta_ratio: number | null;
  requests_delta: number;
  requests_delta_ratio: number | null;
}

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------

export interface AppSettings {
  language: string;
  sync_concurrency: number;
  usage_retention_months: number | null;
  ai_tagging_enabled: boolean;
  digest_export_folder: string | null;
  digest_template: string;
}

// -----------------------------------------------------------------------------
// Sync / Bootstrap
// -----------------------------------------------------------------------------

export type SyncPhase = "idle" | "syncing" | "error";
export type BootstrapPhase = "loading" | "ready" | "error";

export interface SyncState {
  phase: SyncPhase;
  message: string | null;
  started_at: string | null; // ISO 8601
}

export interface BootstrapState {
  phase: BootstrapPhase;
  error: string | null;
}

// -----------------------------------------------------------------------------
// Reading Mode
// -----------------------------------------------------------------------------

export type ReadingMode = "reader" | "web" | "dual";
export type ReaderPanel = "summary" | "translation" | "tagging" | "notes" | "note" | "theme" | null;

// -----------------------------------------------------------------------------
// Panel identifiers for the reader pane
// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// Window / Shell command payloads
// -----------------------------------------------------------------------------

export interface WindowLabel {
  label: string;
}

export interface ShellCommand {
  command: string;
  args?: string[];
}

// -----------------------------------------------------------------------------
// OPML Import flags
// -----------------------------------------------------------------------------

export interface OpmlImportOptions {
  path: string;
  replace: boolean;
  forceSiteName: boolean;
}

export interface ImportResult {
  added: number;
  skipped: number;
  errors: string[];
}

export interface SidebarProjection {
  total_unread: number;
  total_starred: number;
  starred_unread: number;
  total_entries: number;
  total_feeds: number;
  per_feed: FeedCount[];
}

export interface FeedCount {
  feed_id: number;
  title: string;
  unread: number;
  total: number;
}

export interface ImportProgressEvent {
  feed_title: string;
  feed_url: string;
  status: "fetching" | "done" | "error" | "skipped";
  completed: number;
  total: number;
  error?: string;
}

// -----------------------------------------------------------------------------
// Navigation / Sidebar
// -----------------------------------------------------------------------------

export type SidebarSection = "feeds" | "tags" | "digest" | "usage" | "settings";

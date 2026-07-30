use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Core domain models
// ---------------------------------------------------------------------------

/// A subscription feed (RSS/Atom/JSON Feed).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Feed {
    pub id: i64,
    pub title: String,
    pub feed_url: String,
    pub site_url: Option<String>,
    pub feed_parser_version: Option<i32>,
    pub last_fetched_at: Option<String>,
    pub created_at: String,
}

/// A single entry (article) from a feed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub id: i64,
    pub feed_id: i64,
    pub guid: Option<String>,
    pub url: Option<String>,
    pub title: Option<String>,
    pub author: Option<String>,
    pub published_at: Option<String>,
    pub summary: Option<String>,
    pub is_read: bool,
    pub is_starred: bool,
    pub is_deleted: bool,
    pub created_at: String,
}

/// A lightweight entry representation for list views, including the feed title.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryListItem {
    pub id: i64,
    pub feed_id: i64,
    pub title: Option<String>,
    pub author: Option<String>,
    pub url: Option<String>,
    pub published_at: Option<String>,
    pub summary: Option<String>,
    pub is_read: bool,
    pub is_starred: bool,
    pub feed_title: String,
    pub created_at: String,
}

/// Processed content for an entry after the reader pipeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Content {
    pub id: i64,
    pub entry_id: i64,
    pub html: Option<String>,
    pub cleaned_html: Option<String>,
    pub readability_title: Option<String>,
    pub readability_byline: Option<String>,
    pub readability_version: Option<i32>,
    pub markdown: Option<String>,
    pub markdown_version: Option<i32>,
    pub display_mode: String,
    pub document_base_url: Option<String>,
    pub pipeline_type: String,
    pub resolved_intermediate_content: Option<String>,
    pub created_at: String,
}

/// Pre-rendered reader HTML cached per (entry, theme) pair.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentHTMLCache {
    pub entry_id: i64,
    pub theme_id: String,
    pub html: String,
    pub reader_render_version: Option<i32>,
    pub updated_at: String,
}

/// A user-authored note attached to an entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryNote {
    pub entry_id: i64,
    pub markdown_text: String,
    pub created_at: String,
    pub updated_at: String,
}

// ---------------------------------------------------------------------------
// Tag system models
// ---------------------------------------------------------------------------

/// A tag that can be assigned to entries.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub normalized_name: String,
    pub is_provisional: bool,
    pub usage_count: i32,
}

/// An alias for a tag (e.g. "ML" for "Machine Learning").
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagAlias {
    pub id: i64,
    pub tag_id: i64,
    pub alias: String,
    pub normalized_alias: String,
}

/// Association between an entry and a tag with attribution metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryTag {
    pub entry_id: i64,
    pub tag_id: i64,
    pub source: String,
    pub confidence: Option<f64>,
}

// ---------------------------------------------------------------------------
// Agent provider & model configuration models
// ---------------------------------------------------------------------------

/// An LLM provider profile (e.g. OpenAI, Anthropic, local Ollama).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentProviderProfile {
    pub id: i64,
    pub name: String,
    pub base_url: String,
    pub api_key_ref: String,
    pub test_model: Option<String>,
    pub is_default: bool,
    pub is_enabled: bool,
    pub is_archived: bool,
    pub archived_at: Option<String>,
    pub created_at: String,
}

/// A specific model configuration under a provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentModelProfile {
    pub id: i64,
    pub provider_profile_id: i64,
    pub model_name: String,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<i32>,
    pub is_streaming: bool,
    pub supports_summary: bool,
    pub supports_translation: bool,
    pub supports_tagging: bool,
    pub is_default: bool,
    pub is_enabled: bool,
    pub is_archived: bool,
    pub archived_at: Option<String>,
    pub last_tested_at: Option<String>,
    pub created_at: String,
}

/// Routes an agent type to its primary and fallback model profiles.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentProfile {
    pub agent_type: String,
    pub primary_model_profile_id: Option<i64>,
    pub fallback_model_profile_id: Option<i64>,
}

// ---------------------------------------------------------------------------
// Agent task run & LLM usage models
// ---------------------------------------------------------------------------

/// A record of an agent task execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTaskRun {
    pub id: i64,
    pub entry_id: Option<i64>,
    pub task_type: String,
    pub status: String,
    pub request_source: Option<String>,
    pub duration_ms: Option<i32>,
    pub prompt_version: Option<String>,
    pub template_id: Option<String>,
    pub route_model_name: Option<String>,
    pub route_provider_name: Option<String>,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Token usage event logged per LLM request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMUsageEvent {
    pub id: i64,
    pub task_run_id: Option<i64>,
    pub provider_name: String,
    pub provider_base_url: String,
    pub model_name: String,
    pub prompt_tokens: i32,
    pub completion_tokens: i32,
    pub total_tokens: i32,
    pub request_phase: String,
    pub request_status: String,
    pub endpoint_url: Option<String>,
    pub created_at: String,
}

// ---------------------------------------------------------------------------
// Summary & translation result models
// ---------------------------------------------------------------------------

/// A cached AI-generated summary for an entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryResult {
    pub id: i64,
    pub task_run_id: Option<i64>,
    pub entry_id: i64,
    pub target_language: String,
    pub detail_level: String,
    pub text: String,
    pub created_at: String,
}

/// A translation result metadata record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationResult {
    pub id: i64,
    pub task_run_id: Option<i64>,
    pub entry_id: i64,
    pub target_language: String,
    pub source_content_hash: String,
    pub segmenter_version: String,
    pub run_status: String,
    pub created_at: String,
}

/// A single translated segment within a translation result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationSegment {
    pub id: i64,
    pub translation_result_id: i64,
    pub segment_id: String,
    pub source_text: String,
    pub translated_text: String,
    pub order_index: i32,
    pub status: String,
}

// ---------------------------------------------------------------------------
// Batch tagging models
// ---------------------------------------------------------------------------

/// A batch tagging run that processes multiple entries.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagBatchRun {
    pub id: i64,
    pub status: String,
    pub scope_label: Option<String>,
    pub concurrency: i32,
    pub skip_already_applied: bool,
    pub skip_already_tagged: bool,
    pub total_entries: i32,
    pub processed_count: i32,
    pub succeeded_count: i32,
    pub failed_count: i32,
    pub kept_count: i32,
    pub discarded_count: i32,
    pub inserted_count: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// Per-entry lifecycle tracking within a batch run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagBatchEntry {
    pub id: i64,
    pub run_id: i64,
    pub entry_id: i64,
    pub lifecycle_state: String,
    pub attempts: i32,
    pub created_at: String,
}

/// Staging table for proposed tag assignments before review.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagBatchAssignmentStaging {
    pub id: i64,
    pub run_id: i64,
    pub entry_id: i64,
    pub normalized_name: String,
    pub display_name: String,
    pub resolved_tag_id: Option<i64>,
    pub assignment_kind: String,
}

/// Review item for a newly discovered tag name pending user decision.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagBatchNewTagReview {
    pub id: i64,
    pub run_id: i64,
    pub normalized_name: String,
    pub display_name: String,
    pub hit_count: i32,
    pub sample_entry_count: i32,
    pub decision: String,
}

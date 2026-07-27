use std::sync::Arc;
use tokio::sync::RwLock;

use crate::agent::prompt_template::PromptTemplateStore;
use crate::agent::runtime::AgentRuntimeEngine;
use crate::db::agent_config_store::SqliteAgentConfigStore;
use crate::db::agent_task_store::SqliteAgentTaskStore;
use crate::db::content_store_impl::SqliteContentStore;
use crate::db::entry_store::SqliteEntryStore;
use crate::db::feed_store::SqliteFeedStore;
use crate::db::llm_usage_store::SqliteLLMUsageStore;
use crate::db::manager::DatabaseManager;
use crate::db::summary_store::SqliteSummaryStore;
use crate::db::tag_store::SqliteTagStore;
use crate::db::translation_store::SqliteTranslationStore;
use crate::feed::sync_service::SyncService;
use crate::logging::logger::Logger;
use crate::tasking::task_queue::TaskQueue;

/// Global application state managed by Tauri.
pub struct AppState {
    pub db: Arc<DatabaseManager>,
    pub feed_store: Arc<SqliteFeedStore>,
    pub entry_store: Arc<SqliteEntryStore>,
    pub tag_store: Arc<SqliteTagStore>,
    pub content_store: Arc<SqliteContentStore>,
    pub agent_config_store: Arc<SqliteAgentConfigStore>,
    pub agent_task_store: Arc<SqliteAgentTaskStore>,
    pub llm_usage_store: Arc<SqliteLLMUsageStore>,
    pub summary_store: Arc<SqliteSummaryStore>,
    pub translation_store: Arc<SqliteTranslationStore>,
    pub prompt_template_store: Arc<std::sync::Mutex<PromptTemplateStore>>,
    pub sync_service: Arc<SyncService>,
    pub task_queue: Arc<TaskQueue>,
    pub agent_runtime: Arc<AgentRuntimeEngine>,
    pub logger: Option<Arc<Logger>>,
    pub config: Arc<RwLock<AppConfig>>,
}

/// Application-wide configuration.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppConfig {
    /// UI language code (e.g. "en", "zh-CN").
    #[serde(default = "default_language")]
    pub language: String,

    /// Number of concurrent feed sync operations.
    #[serde(default = "default_sync_concurrency")]
    pub sync_concurrency: u32,

    /// Number of months to retain LLM usage records. None means keep forever.
    #[serde(default)]
    pub usage_retention_months: Option<u32>,

    /// Whether AI-powered tagging is enabled globally.
    #[serde(default)]
    pub ai_tagging_enabled: bool,

    /// Default folder for digest exports.
    #[serde(default)]
    pub digest_export_folder: Option<String>,

    /// Selected digest export template.
    #[serde(default = "default_digest_template")]
    pub digest_template: String,
}

fn default_language() -> String {
    "en".to_string()
}

fn default_sync_concurrency() -> u32 {
    6
}

fn default_digest_template() -> String {
    "customize".into()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            language: default_language(),
            sync_concurrency: default_sync_concurrency(),
            usage_retention_months: None,
            ai_tagging_enabled: false,
            digest_export_folder: None,
            digest_template: default_digest_template(),
        }
    }
}

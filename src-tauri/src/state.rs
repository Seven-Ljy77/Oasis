use std::sync::Arc;
use tokio::sync::RwLock;

use crate::agent::runtime::AgentRuntimeEngine;
use crate::db::entry_store::SqliteEntryStore;
use crate::db::feed_store::SqliteFeedStore;
use crate::db::manager::DatabaseManager;
use crate::db::tag_store::SqliteTagStore;
use crate::feed::sync_service::SyncService;
use crate::tasking::task_queue::TaskQueue;

/// Global application state managed by Tauri.
pub struct AppState {
    pub db: Arc<DatabaseManager>,
    pub feed_store: Arc<SqliteFeedStore>,
    pub entry_store: Arc<SqliteEntryStore>,
    pub tag_store: Arc<SqliteTagStore>,
    pub sync_service: Arc<SyncService>,
    pub task_queue: Arc<TaskQueue>,
    pub agent_runtime: Arc<AgentRuntimeEngine>,
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
}

fn default_language() -> String {
    "en".to_string()
}

fn default_sync_concurrency() -> u32 {
    6
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            language: default_language(),
            sync_concurrency: default_sync_concurrency(),
            usage_retention_months: None,
            ai_tagging_enabled: false,
        }
    }
}

use async_trait::async_trait;

use crate::db::models::SummaryResult;
use crate::error::AppError;

/// Persistence operations for AI-generated summaries.
#[async_trait]
pub trait SummaryStore: Send + Sync {
    /// Save a summary result (insert or replace by unique slot).
    async fn save(&self, result: &SummaryResult) -> Result<SummaryResult, AppError>;

    /// Load the summary for a specific (entry, language, detail_level) slot.
    async fn load_by_slot(
        &self,
        entry_id: i64,
        language: &str,
        detail_level: &str,
    ) -> Result<Option<SummaryResult>, AppError>;

    /// Load the most recently created summary for an entry (any language /
    /// detail level).
    async fn load_latest(&self, entry_id: i64) -> Result<Option<SummaryResult>, AppError>;

    /// Remove the summary for a specific slot.
    async fn clear(
        &self,
        entry_id: i64,
        language: &str,
        detail_level: &str,
    ) -> Result<(), AppError>;

    /// Evict the oldest summaries so that at most `max_count` remain.
    async fn evict(&self, max_count: u32) -> Result<(), AppError>;
}

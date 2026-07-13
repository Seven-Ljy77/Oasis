use async_trait::async_trait;

use crate::db::models::{TranslationResult, TranslationSegment};
use crate::error::AppError;

/// Persistence operations for AI-generated translations.
#[async_trait]
pub trait TranslationStore: Send + Sync {
    /// Save a partial translation checkpoint (results + segments). Used during
    /// streaming to persist progress incrementally.
    async fn save_checkpoint(
        &self,
        result: &TranslationResult,
        segments: &[TranslationSegment],
    ) -> Result<(), AppError>;

    /// Finalize a translation run: link the result to its task run and mark
    /// run_status as "succeeded".
    async fn finalize(&self, task_run_id: i64) -> Result<(), AppError>;

    /// Load the translation result and all of its segments for the given entry
    /// and target language.
    async fn load(
        &self,
        entry_id: i64,
        target_language: &str,
    ) -> Result<Option<(TranslationResult, Vec<TranslationSegment>)>, AppError>;

    /// Remove all translation data for the given (entry, language) slot.
    async fn clear(&self, entry_id: i64, target_language: &str) -> Result<(), AppError>;

    /// Evict the oldest translation results so that at most `max_count` remain.
    async fn evict(&self, max_count: u32) -> Result<(), AppError>;
}

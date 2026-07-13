use async_trait::async_trait;

use crate::db::models::{
    TagBatchAssignmentStaging, TagBatchEntry, TagBatchNewTagReview, TagBatchRun,
};
use crate::error::AppError;

/// Persistence operations for AI-driven batch tagging workflows.
#[async_trait]
pub trait TagBatchStore: Send + Sync {
    /// Create a new batch run and return it.
    async fn create_run(&self, run: &TagBatchRun) -> Result<TagBatchRun, AppError>;

    /// Load the currently active (non-finalized) batch run, if any.
    async fn load_active_run(&self) -> Result<Option<TagBatchRun>, AppError>;

    /// Update the status and counters of a batch run.
    async fn update_run_status(&self, run: &TagBatchRun) -> Result<(), AppError>;

    /// Insert or update a per-entry lifecycle record within a batch run.
    async fn upsert_batch_entry(&self, entry: &TagBatchEntry) -> Result<(), AppError>;

    /// Load all staging rows for a run.
    async fn load_staging(
        &self,
        run_id: i64,
    ) -> Result<Vec<TagBatchAssignmentStaging>, AppError>;

    /// Insert or update a staging row.
    async fn upsert_staging(
        &self,
        staging: &TagBatchAssignmentStaging,
    ) -> Result<(), AppError>;

    /// Load new-tag review items for a run.
    async fn load_review_items(
        &self,
        run_id: i64,
    ) -> Result<Vec<TagBatchNewTagReview>, AppError>;

    /// Update the decision on a new-tag review item.
    async fn update_review_decision(
        &self,
        id: i64,
        decision: &str,
    ) -> Result<(), AppError>;

    /// Persist a run checkpoint so progress can be resumed.
    async fn create_checkpoint(&self, run_id: i64) -> Result<(), AppError>;

    /// Load the most recent checkpoint for a run.
    async fn load_checkpoint(
        &self,
        run_id: i64,
    ) -> Result<Option<TagBatchRun>, AppError>;

    /// Finalize a batch run: apply kept assignments and mark the run complete.
    async fn finalize_run(&self, run_id: i64) -> Result<(), AppError>;

    /// Delete all staging data for a run.
    async fn clear_staging(&self, run_id: i64) -> Result<(), AppError>;
}

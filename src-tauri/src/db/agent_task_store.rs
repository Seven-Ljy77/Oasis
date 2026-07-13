use async_trait::async_trait;

use crate::db::models::AgentTaskRun;
use crate::error::AppError;

/// Persistence operations for agent task run records.
#[async_trait]
pub trait AgentTaskStore: Send + Sync {
    /// Persist a new task run record. Returns the record with its assigned id.
    async fn record_run(&self, run: &AgentTaskRun) -> Result<AgentTaskRun, AppError>;

    /// Update the status (and optionally the duration / error_message) of an
    /// existing task run.
    async fn update_run_status(&self, run: &AgentTaskRun) -> Result<(), AppError>;

    /// Load all task runs associated with a particular entry.
    async fn load_by_entry(&self, entry_id: i64) -> Result<Vec<AgentTaskRun>, AppError>;

    /// Load the most recent `limit` task runs across all entries.
    async fn load_recent(&self, limit: u32) -> Result<Vec<AgentTaskRun>, AppError>;
}

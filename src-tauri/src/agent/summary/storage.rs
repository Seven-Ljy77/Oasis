use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Persisted summary result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSummary {
    pub id: i64,
    pub task_run_id: i64,
    pub entry_id: i64,
    pub target_language: String,
    pub detail_level: String,
    pub text: String,
    pub created_at: String,
}

/// Load the cached summary for a given entry, language, and detail level.
pub fn load_summary(
    _entry_id: i64,
    _target_language: &str,
    _detail_level: &str,
) -> Result<Option<SavedSummary>, AppError> {
    todo!()
}

/// Persist a summary result to the database.
pub fn save_summary(
    _task_run_id: i64,
    _entry_id: i64,
    _target_language: &str,
    _detail_level: &str,
    _text: &str,
) -> Result<SavedSummary, AppError> {
    todo!()
}

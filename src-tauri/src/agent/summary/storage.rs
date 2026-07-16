use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::db::summary_store::SummaryStore;
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

impl From<crate::db::models::SummaryResult> for SavedSummary {
    fn from(r: crate::db::models::SummaryResult) -> Self {
        Self {
            id: r.id,
            task_run_id: r.task_run_id,
            entry_id: r.entry_id,
            target_language: r.target_language,
            detail_level: r.detail_level,
            text: r.text,
            created_at: r.created_at,
        }
    }
}

/// Wrapper for summary persistence operations.
pub struct SummaryStorage {
    store: Arc<dyn SummaryStore>,
}

impl SummaryStorage {
    pub fn new(store: Arc<dyn SummaryStore>) -> Self {
        Self { store }
    }

    /// Load the cached summary for a given entry, language, and detail level.
    pub async fn load_summary(
        &self,
        entry_id: i64,
        target_language: &str,
        detail_level: &str,
    ) -> Result<Option<SavedSummary>, AppError> {
        let result = self
            .store
            .load_by_slot(entry_id, target_language, detail_level)
            .await?;
        Ok(result.map(SavedSummary::from))
    }

    /// Persist a summary result to the database.
    pub async fn save_summary(
        &self,
        task_run_id: i64,
        entry_id: i64,
        target_language: &str,
        detail_level: &str,
        text: &str,
    ) -> Result<SavedSummary, AppError> {
        let result = crate::db::models::SummaryResult {
            id: 0,
            task_run_id,
            entry_id,
            target_language: target_language.to_string(),
            detail_level: detail_level.to_string(),
            text: text.to_string(),
            created_at: String::new(),
        };
        let saved = self.store.save(&result).await?;
        Ok(SavedSummary::from(saved))
    }
}

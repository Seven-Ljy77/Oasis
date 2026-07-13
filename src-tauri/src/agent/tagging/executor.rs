use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// A tag suggestion from the AI agent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagSuggestion {
    pub name: String,
    pub is_new: bool,
    pub confidence: Option<f64>,
    pub existing_tag_id: Option<i64>,
}

/// Executor for single-entry tagging AI agent tasks.
pub struct TaggingExecutor;

impl TaggingExecutor {
    pub fn new() -> Self {
        Self
    }

    /// Run tagging for a single entry, returning a list of tag suggestions.
    pub async fn execute_for_entry(_entry_id: i64) -> Result<Vec<TagSuggestion>, AppError> {
        todo!()
    }

    /// Apply user-selected tags from the suggestions.
    pub async fn apply_tags(
        _entry_id: i64,
        _tag_names: &[String],
        _source: &str,
    ) -> Result<(), AppError> {
        todo!()
    }
}

impl Default for TaggingExecutor {
    fn default() -> Self {
        Self::new()
    }
}

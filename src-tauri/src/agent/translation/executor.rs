use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Request to run a translation task.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationRunRequest {
    pub entry_id: i64,
    pub target_language: String,
}

/// Events emitted during a translation run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TranslationRunEvent {
    Started { entry_id: i64 },
    SegmentCompleted {
        entry_id: i64,
        segment_id: String,
        translated_text: String,
    },
    Completed { entry_id: i64, total_segments: usize },
    Failed { entry_id: i64, error: String },
}

/// Executor for translation AI agent tasks.
pub struct TranslationExecutor;

impl TranslationExecutor {
    pub fn new() -> Self {
        Self
    }

    /// Execute a translation run for an entry.
    pub async fn execute(
        _request: &TranslationRunRequest,
        _on_event: impl Fn(TranslationRunEvent) + Send + 'static,
    ) -> Result<(), AppError> {
        todo!()
    }
}

impl Default for TranslationExecutor {
    fn default() -> Self {
        Self::new()
    }
}

use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Request to run a summary task.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryRunRequest {
    pub entry_id: i64,
    pub target_language: String,
    pub detail_level: String,
}

/// Events emitted during a summary run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SummaryRunEvent {
    /// The summary generation has started.
    Started { entry_id: i64 },
    /// A token of streaming output.
    Token { entry_id: i64, token: String },
    /// The run has completed (final text and metadata).
    Terminal {
        entry_id: i64,
        full_text: String,
        target_language: String,
        detail_level: String,
    },
}

/// Executor for summary AI agent tasks.
pub struct SummaryExecutor;

impl SummaryExecutor {
    pub fn new() -> Self {
        Self
    }

    /// Execute a summary run, streaming tokens via the provided callback.
    pub async fn execute(
        _request: &SummaryRunRequest,
        _on_event: impl Fn(SummaryRunEvent) + Send + 'static,
    ) -> Result<(), AppError> {
        todo!()
    }
}

impl Default for SummaryExecutor {
    fn default() -> Self {
        Self::new()
    }
}

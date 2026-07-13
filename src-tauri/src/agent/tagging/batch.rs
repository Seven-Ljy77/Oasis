use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Configuration for a batch tagging run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchTaggingConfig {
    pub scope_label: Option<String>,
    pub concurrency: u32,
    pub skip_already_applied: bool,
    pub skip_already_tagged: bool,
    pub entry_ids: Option<Vec<i64>>,
}

/// Events emitted during a batch tagging run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BatchTaggingEvent {
    Started {
        run_id: i64,
        total_entries: usize,
    },
    Progress {
        run_id: i64,
        processed: usize,
        succeeded: usize,
        failed: usize,
    },
    NewTagProposed {
        run_id: i64,
        normalized_name: String,
        display_name: String,
        hit_count: usize,
    },
    Completed {
        run_id: i64,
        total: usize,
        succeeded: usize,
        failed: usize,
        kept: usize,
        discarded: usize,
    },
    Failed {
        run_id: i64,
        error: String,
    },
}

/// Executor for batch tagging operations.
pub struct BatchTaggingExecutor;

impl BatchTaggingExecutor {
    pub fn new() -> Self {
        Self
    }

    /// Start a batch tagging run.
    pub async fn execute(
        _config: &BatchTaggingConfig,
        _on_event: impl Fn(BatchTaggingEvent) + Send + 'static,
    ) -> Result<i64, AppError> {
        todo!()
    }

    /// Review a proposed new tag from a batch run.
    pub async fn review_tag(
        _run_id: i64,
        _normalized_name: &str,
        _decision: &str, // "keep" | "discard"
    ) -> Result<(), AppError> {
        todo!()
    }

    /// Finalize a batch run after all review decisions are made.
    pub async fn finalize(_run_id: i64) -> Result<(), AppError> {
        todo!()
    }

    /// Cancel a running batch.
    pub async fn cancel(_run_id: i64) -> Result<(), AppError> {
        todo!()
    }
}

impl Default for BatchTaggingExecutor {
    fn default() -> Self {
        Self::new()
    }
}

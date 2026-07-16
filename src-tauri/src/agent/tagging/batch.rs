use std::sync::Arc;
use tokio::sync::Semaphore;

use serde::{Deserialize, Serialize};

use crate::agent::tagging::executor::TaggingExecutor;
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
pub struct BatchTaggingExecutor {
    tagging: Arc<TaggingExecutor>,
}

impl BatchTaggingExecutor {
    pub fn new(tagging: Arc<TaggingExecutor>) -> Self {
        Self { tagging }
    }

    /// Start a batch tagging run. Processes entries concurrently using a semaphore.
    pub async fn execute(
        &self,
        config: &BatchTaggingConfig,
        on_event: impl Fn(BatchTaggingEvent) + Send + Sync + 'static,
    ) -> Result<i64, AppError> {
        let on_event = Arc::new(on_event);
        let entry_ids = match &config.entry_ids {
            Some(ids) if !ids.is_empty() => ids.clone(),
            _ => {
                return Err(AppError::InvalidInput(
                    "Batch tagging requires a non-empty entry list".to_string(),
                ));
            }
        };

        // Validate entry count limits
        if entry_ids.len() > 2000 {
            return Err(AppError::InvalidInput(
                "Batch tagging is limited to 2000 entries".to_string(),
            ));
        }

        let run_id = chrono::Utc::now().timestamp_millis(); // Simple timestamp-based run_id
        let total = entry_ids.len();

        on_event(BatchTaggingEvent::Started {
            run_id,
            total_entries: total,
        });

        let concurrency = config.concurrency.clamp(1, 5) as usize;
        let semaphore = Arc::new(Semaphore::new(concurrency));

        let mut succeeded = 0usize;
        let mut failed = 0usize;

        let mut handles = Vec::new();
        for entry_id in entry_ids {
            let tagging = self.tagging.clone();
            let sem = semaphore.clone();
            let _on_event = Arc::clone(&on_event);

            let handle = tokio::spawn(async move {
                let _permit = sem.acquire().await.map_err(|_| {
                    AppError::Agent("Semaphore closed".to_string())
                })?;

                // For batch, we use minimal content (title only) to be efficient
                let result = tagging
                    .execute_for_entry(entry_id, &format!("Entry #{entry_id}"), "")
                    .await;

                match result {
                    Ok(suggestions) => Ok((entry_id, suggestions)),
                    Err(e) => Err(e),
                }
            });
            handles.push(handle);
        }

        for handle in handles {
            match handle.await {
                Ok(Ok((_entry_id, _suggestions))) => {
                    succeeded += 1;
                }
                Ok(Err(_)) => {
                    failed += 1;
                }
                Err(_) => {
                    failed += 1;
                }
            }
            on_event(BatchTaggingEvent::Progress {
                run_id,
                processed: succeeded + failed,
                succeeded,
                failed,
            });
        }

        on_event(BatchTaggingEvent::Completed {
            run_id,
            total,
            succeeded,
            failed,
            kept: succeeded,
            discarded: 0,
        });

        Ok(run_id)
    }

    /// Review a proposed new tag from a batch run.
    pub async fn review_tag(
        &self,
        _run_id: i64,
        _normalized_name: &str,
        decision: &str, // "keep" | "discard"
    ) -> Result<(), AppError> {
        if decision != "keep" && decision != "discard" {
            return Err(AppError::InvalidInput(
                "Decision must be 'keep' or 'discard'".to_string(),
            ));
        }
        // In a full implementation, this would update the tag_batch_new_tag_review table.
        // For now, this is a stub that accepts the decision.
        Ok(())
    }

    /// Finalize a batch run after all review decisions are made.
    pub async fn finalize(&self, _run_id: i64) -> Result<(), AppError> {
        // In a full implementation, this would:
        // 1. Apply all "keep" assignments from tag_batch_assignment_staging
        // 2. Create new tags for kept proposals
        // 3. Update entry_tag records
        // 4. Mark the run as finalized
        Ok(())
    }

    /// Cancel a running batch.
    pub async fn cancel(&self, _run_id: i64) -> Result<(), AppError> {
        // In a full implementation, this would set cancellation tokens
        // for all active workers in the batch
        Ok(())
    }
}

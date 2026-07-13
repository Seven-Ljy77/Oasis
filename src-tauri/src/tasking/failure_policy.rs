use crate::error::AppError;
use super::TaskKind;

/// Determine whether a task failure should be surfaced to the user.
/// Some transient failures are handled silently with retries.
pub fn should_surface(_kind: &TaskKind, _error: &AppError) -> bool {
    todo!()
}

/// Get the retry count for a given task kind.
pub fn max_retries(kind: &TaskKind) -> u32 {
    match kind {
        TaskKind::SyncFeed | TaskKind::SyncAll => 3,
        TaskKind::AgentRun => 2,
        TaskKind::BatchTagging => 1,
        _ => 1,
    }
}

/// Calculate the backoff delay for a retry attempt.
pub fn retry_backoff(_kind: &TaskKind, _attempt: u32) -> std::time::Duration {
    todo!()
}

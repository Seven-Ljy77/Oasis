use std::time::Duration;

use crate::agent::failure;
use crate::error::AppError;
use super::TaskKind;

/// Determine whether a task failure should be surfaced to the user.
/// Transient network/timeout failures are handled silently with retries.
pub fn should_surface(kind: &TaskKind, error: &AppError) -> bool {
    let reason = failure::classify(error);
    match reason {
        // Never surface transient errors that will be retried
        failure::AgentFailureReason::NetworkError
        | failure::AgentFailureReason::Timeout
        | failure::AgentFailureReason::RateLimited => false,
        // Auth errors always surface
        failure::AgentFailureReason::AuthenticationFailed => true,
        // Model issues surface for agent runs only
        failure::AgentFailureReason::ModelUnavailable
        | failure::AgentFailureReason::ContextLengthExceeded => {
            matches!(kind, TaskKind::AgentRun | TaskKind::BatchTagging)
        }
        // Always surface
        failure::AgentFailureReason::InvalidRequest
        | failure::AgentFailureReason::ContentFiltered
        | failure::AgentFailureReason::ParsingError => true,
        // Cancelled — don't surface (intentional)
        failure::AgentFailureReason::Cancelled => false,
        // Unknown errors surface
        failure::AgentFailureReason::Unknown => true,
    }
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
/// Delegates to the agent failure module for consistent backoff calculations.
pub fn retry_backoff(kind: &TaskKind, attempt: u32) -> Duration {
    // Use a generic NetworkError as the reason for the delay calculation
    let reason = match kind {
        TaskKind::AgentRun | TaskKind::BatchTagging => failure::AgentFailureReason::NetworkError,
        _ => failure::AgentFailureReason::NetworkError,
    };
    failure::retry_delay(attempt, &reason)
}

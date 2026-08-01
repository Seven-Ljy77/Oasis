use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Classified reason for an agent run failure.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AgentFailureReason {
    NetworkError,
    Timeout,
    RateLimited,
    AuthenticationFailed,
    InvalidRequest,
    ModelUnavailable,
    ContentFiltered,
    ContextLengthExceeded,
    ParsingError,
    Cancelled,
    Unknown,
}

/// Classify an `AppError` into a specific `AgentFailureReason`.
pub fn classify(error: &AppError) -> AgentFailureReason {
    match error {
        AppError::Network(msg) => {
            let lower = msg.to_lowercase();
            if lower.contains("timeout") || lower.contains("timed out") {
                AgentFailureReason::Timeout
            } else if lower.contains("dns") || lower.contains("refused") || lower.contains("reset") {
                AgentFailureReason::NetworkError
            } else if lower.contains("too many") || lower.contains("rate limit") {
                AgentFailureReason::RateLimited
            } else {
                AgentFailureReason::NetworkError
            }
        }
        AppError::Timeout(_) => AgentFailureReason::Timeout,
        AppError::Unauthorized(_) => AgentFailureReason::AuthenticationFailed,
        AppError::InvalidInput(msg) => {
            let lower = msg.to_lowercase();
            if lower.contains("context length") || lower.contains("token") {
                AgentFailureReason::ContextLengthExceeded
            } else if lower.contains("content filter") || lower.contains("safety") {
                AgentFailureReason::ContentFiltered
            } else {
                AgentFailureReason::InvalidRequest
            }
        }
        AppError::NotFound(_) => AgentFailureReason::ModelUnavailable,
        AppError::Agent(msg) => {
            let lower = msg.to_lowercase();
            if lower.contains("rate limit") || lower.contains("too many") {
                AgentFailureReason::RateLimited
            } else if lower.contains("model not found") || lower.contains("unavailable") {
                AgentFailureReason::ModelUnavailable
            } else if lower.contains("context length") || lower.contains("token limit") {
                AgentFailureReason::ContextLengthExceeded
            } else if lower.contains("content filter") || lower.contains("safety") || lower.contains("refused") {
                AgentFailureReason::ContentFiltered
            } else {
                AgentFailureReason::Unknown
            }
        }
        AppError::Cancelled => AgentFailureReason::Cancelled,
        AppError::Unknown(msg) => {
            let lower = msg.to_lowercase();
            if lower.contains("parse") || lower.contains("json") || lower.contains("serde") {
                AgentFailureReason::ParsingError
            } else {
                AgentFailureReason::Unknown
            }
        }
        _ => AgentFailureReason::Unknown,
    }
}

/// Determine whether a failure is retryable.
pub fn is_retryable(reason: &AgentFailureReason) -> bool {
    matches!(reason,
        AgentFailureReason::NetworkError
        | AgentFailureReason::Timeout
        | AgentFailureReason::RateLimited
        | AgentFailureReason::ModelUnavailable)
}

/// Calculate exponential backoff delay with jitter.
///
/// Base delays per failure type:
/// - RateLimited: base 5s
/// - NetworkError / Timeout: base 1s
/// - ModelUnavailable: base 2s
/// - Others: 0 (no retry)
pub fn retry_delay(attempt: u32, reason: &AgentFailureReason) -> Duration {
    let base_ms = match reason {
        AgentFailureReason::RateLimited => 5000,
        AgentFailureReason::NetworkError | AgentFailureReason::Timeout => 1000,
        AgentFailureReason::ModelUnavailable => 2000,
        _ => return Duration::from_secs(0),
    };

    // Exponential: base * 2^(attempt-1), capped at 120s
    let delay_ms = (base_ms as u64) * (1u64 << attempt.saturating_sub(1));
    let capped_ms = delay_ms.min(120_000);

    // Add jitter: +/- 25%
    let jitter = capped_ms / 4;
    // Deterministic but varied: use attempt as seed-adjacent offset
    let offset = (attempt as u64 * 73) % (jitter * 2 + 1);
    let final_ms = capped_ms.saturating_sub(jitter).saturating_add(offset);

    Duration::from_millis(final_ms)
}

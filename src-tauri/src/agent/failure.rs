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

/// Classify an error into a specific failure reason for retry policy decisions.
pub fn classify(_error: &AppError) -> AgentFailureReason {
    todo!()
}

/// Determine whether a failure is retryable.
pub fn is_retryable(reason: &AgentFailureReason) -> bool {
    match reason {
        AgentFailureReason::NetworkError
        | AgentFailureReason::Timeout
        | AgentFailureReason::RateLimited
        | AgentFailureReason::ModelUnavailable => true,
        _ => false,
    }
}

/// Calculate the delay before retrying after a failure.
pub fn retry_delay(_attempt: u32, _reason: &AgentFailureReason) -> std::time::Duration {
    todo!()
}

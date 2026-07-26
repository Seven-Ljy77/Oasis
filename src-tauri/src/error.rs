use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Feed error: {0}")]
    Feed(String),

    #[error("Agent error: {0}")]
    Agent(String),

    #[error("Reader error: {0}")]
    Reader(String),

    #[error("Digest error: {0}")]
    Digest(String),

    #[error("Tag error: {0}")]
    Tag(String),

    #[error("Usage error: {0}")]
    Usage(String),

    #[error("Tasking error: {0}")]
    Tasking(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Shell error: {0}")]
    Shell(String),

    #[error("Logging error: {0}")]
    Logging(String),

    #[error("Timeout: {0}")]
    Timeout(String),

    #[error("Cancelled")]
    Cancelled,

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::Database(err.to_string())
    }
}

impl From<tokio::sync::oneshot::error::RecvError> for AppError {
    fn from(_err: tokio::sync::oneshot::error::RecvError) -> Self {
        AppError::Unknown("oneshot channel closed".to_string())
    }
}

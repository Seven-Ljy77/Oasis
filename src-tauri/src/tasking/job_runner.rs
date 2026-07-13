use std::future::Future;
use std::time::Duration;

use crate::error::AppError;

/// Executes a job with a timeout.
pub struct JobRunner;

impl JobRunner {
    pub fn new() -> Self {
        Self
    }

    /// Run a future with a timeout and cancellation support.
    pub async fn run_with_timeout<F, T>(
        _future: F,
        _timeout: Duration,
    ) -> Result<T, AppError>
    where
        F: Future<Output = Result<T, AppError>> + Send,
        T: Send,
    {
        todo!()
    }

    /// Run a future with support for external cancellation via a oneshot channel.
    pub async fn run_cancellable<F, T>(
        _future: F,
        _cancel_rx: tokio::sync::oneshot::Receiver<()>,
        _timeout: Option<Duration>,
    ) -> Result<T, AppError>
    where
        F: Future<Output = Result<T, AppError>> + Send,
        T: Send,
    {
        todo!()
    }
}

impl Default for JobRunner {
    fn default() -> Self {
        Self::new()
    }
}

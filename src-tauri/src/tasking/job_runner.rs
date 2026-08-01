use std::future::Future;
use std::time::Duration;
use tokio::sync::oneshot;

use crate::error::AppError;

/// Executes a job with timeout and cancellation support.
pub struct JobRunner;

impl JobRunner {
    pub fn new() -> Self {
        Self
    }

    /// Run a future with a timeout.
    pub async fn run_with_timeout<F, T>(
        future: F,
        timeout: Duration,
    ) -> Result<T, AppError>
    where
        F: Future<Output = Result<T, AppError>> + Send,
        T: Send,
    {
        tokio::time::timeout(timeout, future)
            .await
            .map_err(|_elapsed| AppError::Timeout("Job timed out".to_string()))?
    }

    /// Run a future with external cancellation and optional timeout.
    pub async fn run_cancellable<F, T>(
        future: F,
        cancel_rx: oneshot::Receiver<()>,
        timeout: Option<Duration>,
    ) -> Result<T, AppError>
    where
        F: Future<Output = Result<T, AppError>> + Send,
        T: Send,
    {
        let mut fut = std::pin::pin!(future);
        let mut cancel_rx = cancel_rx;

        match timeout {
            Some(dur) => {
                let sleep = tokio::time::sleep(dur);
                tokio::pin!(sleep);
                tokio::select! {
                    result = &mut fut => result,
                    _ = &mut sleep => Err(AppError::Timeout("Job timed out".to_string())),
                    _ = &mut cancel_rx => Err(AppError::Cancelled),
                }
            }
            None => {
                tokio::select! {
                    result = &mut fut => result,
                    _ = &mut cancel_rx => Err(AppError::Cancelled),
                }
            }
        }
    }
}

impl Default for JobRunner {
    fn default() -> Self {
        Self::new()
    }
}

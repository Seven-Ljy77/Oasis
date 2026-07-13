use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

use crate::db::models::Feed;
use crate::error::AppError;

/// Tracks rate limits for feed fetching.
pub struct RateLimitTracker {
    last_request: Arc<Mutex<Option<Instant>>>,
    min_interval: Duration,
}

impl RateLimitTracker {
    pub fn new(min_interval: Duration) -> Self {
        Self {
            last_request: Arc::new(Mutex::new(None)),
            min_interval,
        }
    }

    /// Wait until the rate limit interval has passed since the last request.
    pub async fn wait_if_needed(&self) {
        todo!()
    }

    /// Record that a request was just made.
    pub async fn record_request(&self) {
        todo!()
    }
}

/// Service that orchestrates feed synchronization.
pub struct SyncService {
    rate_limiter: RateLimitTracker,
}

impl SyncService {
    pub fn new() -> Self {
        Self {
            rate_limiter: RateLimitTracker::new(Duration::from_secs(2)),
        }
    }

    /// Synchronize a single feed by fetching and parsing its content.
    pub async fn sync_feed(&self, _feed: &Feed) -> Result<SyncResult, AppError> {
        todo!()
    }

    /// Synchronize all feeds with configurable concurrency.
    pub async fn sync_all(&self, _concurrency: u32) -> Result<Vec<SyncResult>, AppError> {
        todo!()
    }
}

impl Default for SyncService {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of synchronizing a single feed.
#[derive(Debug, Clone)]
pub struct SyncResult {
    pub feed_id: i64,
    pub new_entries: usize,
    pub updated_entries: usize,
    pub error: Option<String>,
}

/// Progress information emitted during a sync operation.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SyncProgress {
    pub feed_id: i64,
    pub feed_title: Option<String>,
    pub status: SyncStatus,
    pub new_entries: usize,
    pub total_feeds: usize,
    pub completed_feeds: usize,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum SyncStatus {
    Pending,
    Fetching,
    Parsing,
    Persisting,
    Completed,
    Failed(String),
}

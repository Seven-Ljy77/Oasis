use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

use crate::db::entry_store::{EntryStore, EntryUpsertData, SqliteEntryStore};
use crate::db::feed_store::{FeedStore, SqliteFeedStore};
use crate::db::models::Feed;
use crate::error::AppError;
use crate::feed::feed_parser::parse_feed;

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
        let last = self.last_request.lock().await;
        if let Some(last_request) = *last {
            let elapsed = last_request.elapsed();
            if elapsed < self.min_interval {
                let wait_time = self.min_interval - elapsed;
                tokio::time::sleep(wait_time).await;
            }
        }
    }

    /// Record that a request was just made.
    pub async fn record_request(&self) {
        let mut last = self.last_request.lock().await;
        *last = Some(Instant::now());
    }
}

/// Service that orchestrates feed synchronization.
pub struct SyncService {
    feed_store: Arc<SqliteFeedStore>,
    entry_store: Arc<SqliteEntryStore>,
    rate_limiter: RateLimitTracker,
}

impl SyncService {
    pub fn new(
        feed_store: Arc<SqliteFeedStore>,
        entry_store: Arc<SqliteEntryStore>,
    ) -> Self {
        Self {
            feed_store,
            entry_store,
            rate_limiter: RateLimitTracker::new(Duration::from_secs(2)),
        }
    }

    /// Synchronize a single feed by fetching and parsing its content.
    pub async fn sync_feed(&self, feed: &Feed) -> Result<SyncResult, AppError> {
        let feed_id = feed.id;

        // Rate limit before fetching.
        self.rate_limiter.wait_if_needed().await;

        // Fetch the feed XML.
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("Mercury/0.1 (RSS Reader)")
            .build()
            .map_err(|e| AppError::Network(e.to_string()))?;

        let response = client
            .get(&feed.feed_url)
            .send()
            .await
            .map_err(|e| {
                AppError::Network(format!(
                    "Failed to fetch feed '{}': {}",
                    feed.feed_url, e
                ))
            })?;

        self.rate_limiter.record_request().await;

        if !response.status().is_success() {
            return Ok(SyncResult {
                feed_id,
                new_entries: 0,
                updated_entries: 0,
                error: Some(format!("HTTP {}", response.status())),
            });
        }

        let xml = response.text().await.map_err(|e| {
            AppError::Network(format!("Failed to read response body: {}", e))
        })?;

        // Parse the feed.
        let parsed = parse_feed(&xml)?;

        // Update feed metadata (title, site_url, last_fetched_at).
        let now = chrono::Utc::now().to_rfc3339();
        let updated_feed = Feed {
            title: parsed
                .title
                .clone()
                .unwrap_or_else(|| feed.title.clone()),
            site_url: parsed.site_url.or(feed.site_url.clone()),
            last_fetched_at: Some(now.clone()),
            feed_parser_version: Some(1),
            ..feed.clone()
        };
        self.feed_store.upsert(updated_feed).await?;

        // Convert parsed entries to upsert data.
        let entry_data: Vec<EntryUpsertData> = parsed
            .entries
            .iter()
            .map(|e| EntryUpsertData {
                guid: e.guid.clone(),
                url: e.url.clone(),
                title: e.title.clone(),
                author: e.author.clone(),
                published_at: e.published_at.clone(),
                summary: e.summary.clone(),
            })
            .collect();

        let new_entries = self
            .entry_store
            .upsert_entries(feed_id, &entry_data)
            .await?;

        Ok(SyncResult {
            feed_id,
            new_entries,
            updated_entries: 0,
            error: None,
        })
    }

    /// Synchronize all feeds with configurable concurrency.
    /// The `on_progress` callback is called for each feed as syncing starts and completes.
    pub async fn sync_all(
        &self,
        concurrency: u32,
        on_progress: impl Fn(&Feed, SyncStatus, usize, usize) + Send + Sync + 'static,
    ) -> Result<Vec<SyncResult>, AppError> {
        let feeds = self.feed_store.load_all().await?;
        let total = feeds.len();
        let completed = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));

        let concurrency = concurrency.max(1) as usize;
        let semaphore = Arc::new(tokio::sync::Semaphore::new(concurrency));
        let mut join_set = tokio::task::JoinSet::new();

        let feed_store = self.feed_store.clone();
        let entry_store = self.entry_store.clone();
        let on_progress = Arc::new(on_progress);

        for feed in feeds {
            let permit = semaphore
                .clone()
                .acquire_owned()
                .await
                .map_err(|e| AppError::Unknown(format!("Semaphore error: {}", e)))?;

            let feed_store = feed_store.clone();
            let entry_store = entry_store.clone();
            let completed = completed.clone();
            let on_progress = on_progress.clone();
            let feed_clone = feed.clone();
            let total_feeds = total;

            on_progress(&feed_clone, SyncStatus::Fetching, completed.load(std::sync::atomic::Ordering::SeqCst), total_feeds);

            join_set.spawn(async move {
                let _permit = permit;
                let result = sync_single_feed(&feed_store, &entry_store, &feed_clone).await;
                let n = completed.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
                let status = if result.error.is_some() {
                    SyncStatus::Failed(result.error.clone().unwrap_or_default())
                } else {
                    SyncStatus::Completed
                };
                on_progress(&feed_clone, status, n, total_feeds);
                result
            });
        }

        let mut results = Vec::new();
        while let Some(result) = join_set.join_next().await {
            match result {
                Ok(sync_result) => results.push(sync_result),
                Err(e) => {
                    results.push(SyncResult {
                        feed_id: 0,
                        new_entries: 0,
                        updated_entries: 0,
                        error: Some(format!("Join error: {}", e)),
                    });
                }
            }
        }

        Ok(results)
    }
}

/// Synchronize a single feed using the given stores (standalone for use in spawned tasks).
async fn sync_single_feed(
    feed_store: &SqliteFeedStore,
    entry_store: &SqliteEntryStore,
    feed: &Feed,
) -> SyncResult {
    let feed_id = feed.id;

    // Fetch the feed XML.
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("Mercury/0.1 (RSS Reader)")
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return SyncResult {
                feed_id,
                new_entries: 0,
                updated_entries: 0,
                error: Some(format!("Failed to create HTTP client: {}", e)),
            };
        }
    };

    let response = match client.get(&feed.feed_url).send().await {
        Ok(r) => r,
        Err(e) => {
            return SyncResult {
                feed_id,
                new_entries: 0,
                updated_entries: 0,
                error: Some(format!("Failed to fetch feed: {}", e)),
            };
        }
    };

    if !response.status().is_success() {
        return SyncResult {
            feed_id,
            new_entries: 0,
            updated_entries: 0,
            error: Some(format!("HTTP {}", response.status())),
        };
    }

    let xml = match response.text().await {
        Ok(x) => x,
        Err(e) => {
            return SyncResult {
                feed_id,
                new_entries: 0,
                updated_entries: 0,
                error: Some(format!("Failed to read response: {}", e)),
            };
        }
    };

    // Parse the feed.
    let parsed = match parse_feed(&xml) {
        Ok(p) => p,
        Err(e) => {
            return SyncResult {
                feed_id,
                new_entries: 0,
                updated_entries: 0,
                error: Some(e.to_string()),
            };
        }
    };

    // Update feed metadata.
    let now = chrono::Utc::now().to_rfc3339();
    let updated_feed = Feed {
        title: parsed
            .title
            .clone()
            .unwrap_or_else(|| feed.title.clone()),
        site_url: parsed.site_url.or(feed.site_url.clone()),
        last_fetched_at: Some(now.clone()),
        feed_parser_version: Some(1),
        ..feed.clone()
    };
    if let Err(e) = feed_store.upsert(updated_feed).await {
        return SyncResult {
            feed_id,
            new_entries: 0,
            updated_entries: 0,
            error: Some(format!("Failed to update feed metadata: {}", e)),
        };
    }

    // Upsert entries.
    let entry_data: Vec<EntryUpsertData> = parsed
        .entries
        .iter()
        .map(|e| EntryUpsertData {
            guid: e.guid.clone(),
            url: e.url.clone(),
            title: e.title.clone(),
            author: e.author.clone(),
            published_at: e.published_at.clone(),
            summary: e.summary.clone(),
        })
        .collect();

    match entry_store.upsert_entries(feed_id, &entry_data).await {
        Ok(count) => SyncResult {
            feed_id,
            new_entries: count,
            updated_entries: 0,
            error: None,
        },
        Err(e) => SyncResult {
            feed_id,
            new_entries: 0,
            updated_entries: 0,
            error: Some(format!("Failed to upsert entries: {}", e)),
        },
    }
}

/// Result of synchronizing a single feed.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
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

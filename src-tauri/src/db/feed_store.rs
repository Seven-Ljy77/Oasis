use async_trait::async_trait;

use crate::db::models::Feed;
use crate::error::AppError;

/// Persistence operations for subscription feeds.
#[async_trait]
pub trait FeedStore: Send + Sync {
    /// Load all feeds ordered by title.
    async fn load_all(&self) -> Result<Vec<Feed>, AppError>;

    /// Insert a new feed or update an existing one (matched by feed_url).
    async fn upsert(&self, feed: Feed) -> Result<Feed, AppError>;

    /// Delete a feed and all of its entries (cascading).
    async fn delete(&self, id: i64) -> Result<(), AppError>;

    /// Find a feed by its feed_url.
    async fn find_by_url(&self, url: &str) -> Result<Option<Feed>, AppError>;
}

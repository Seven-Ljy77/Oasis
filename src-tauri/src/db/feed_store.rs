use std::sync::Arc;

use async_trait::async_trait;
use rusqlite::params;

use crate::db::manager::DatabaseManager;
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

/// SQLite-backed implementation of FeedStore.
pub struct SqliteFeedStore {
    db: Arc<DatabaseManager>,
}

impl SqliteFeedStore {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl FeedStore for SqliteFeedStore {
    async fn load_all(&self) -> Result<Vec<Feed>, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT id, title, feed_url, site_url, feed_parser_version, last_fetched_at, created_at \
                     FROM feed ORDER BY title COLLATE NOCASE",
                )?;
                let feeds = stmt
                    .query_map([], |row| {
                        Ok(Feed {
                            id: row.get(0)?,
                            title: row.get(1)?,
                            feed_url: row.get(2)?,
                            site_url: row.get(3)?,
                            feed_parser_version: row.get(4)?,
                            last_fetched_at: row.get(5)?,
                            created_at: row.get(6)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(feeds)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn upsert(&self, feed: Feed) -> Result<Feed, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "INSERT INTO feed (title, feed_url, site_url, feed_parser_version, last_fetched_at, created_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6) \
                     ON CONFLICT(feed_url) DO UPDATE SET \
                        title = excluded.title, \
                        site_url = excluded.site_url, \
                        feed_parser_version = excluded.feed_parser_version, \
                        last_fetched_at = excluded.last_fetched_at",
                    params![
                        feed.title,
                        feed.feed_url,
                        feed.site_url,
                        feed.feed_parser_version,
                        feed.last_fetched_at,
                        feed.created_at,
                    ],
                )?;
                let id = conn.last_insert_rowid();
                Ok(Feed { id, ..feed })
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn delete(&self, id: i64) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute("DELETE FROM feed WHERE id = ?1", params![id])?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn find_by_url(&self, url: &str) -> Result<Option<Feed>, AppError> {
        let url = url.to_string();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT id, title, feed_url, site_url, feed_parser_version, last_fetched_at, created_at \
                     FROM feed WHERE feed_url = ?1",
                )?;
                let mut rows = stmt.query_map(params![url], |row| {
                    Ok(Feed {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        feed_url: row.get(2)?,
                        site_url: row.get(3)?,
                        feed_parser_version: row.get(4)?,
                        last_fetched_at: row.get(5)?,
                        created_at: row.get(6)?,
                    })
                })?;
                Ok(rows.next().transpose()?)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }
}

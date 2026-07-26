use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::db::manager::DatabaseManager;
use crate::error::AppError;

/// Projection of sidebar counts (unread, starred, total per feed).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidebarProjection {
    pub total_unread: usize,
    pub total_starred: usize,
    pub starred_unread: usize,
    pub total_entries: usize,
    pub total_feeds: usize,
    pub per_feed: Vec<FeedCount>,
}

/// Per-feed count projection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeedCount {
    pub feed_id: i64,
    pub title: String,
    pub unread: usize,
    pub total: usize,
}

/// Compute the sidebar projection from the database.
pub fn compute_projection(db: &Arc<DatabaseManager>) -> Result<SidebarProjection, AppError> {
    let db = db.clone();
    // Run all queries synchronously inside spawn_blocking.
    db.read(move |conn| {
        // Total unread across all feeds.
        let total_unread: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM entry WHERE is_deleted = 0 AND is_read = 0",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // Total starred.
        let total_starred: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM entry WHERE is_deleted = 0 AND is_starred = 1",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // Starred and unread.
        let starred_unread: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM entry WHERE is_deleted = 0 AND is_starred = 1 AND is_read = 0",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // Total entries (non-deleted).
        let total_entries: usize = conn
            .query_row(
                "SELECT COUNT(*) FROM entry WHERE is_deleted = 0",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // Total feeds.
        let total_feeds: usize = conn
            .query_row("SELECT COUNT(*) FROM feed", [], |row| row.get(0))
            .unwrap_or(0);

        // Per-feed counts: unread and total (non-deleted) entries.
        let mut stmt = conn
            .prepare(
                "SELECT f.id, f.title,
                        COUNT(CASE WHEN e.is_read = 0 THEN 1 END) AS unread,
                        COUNT(e.id) AS total
                 FROM feed f
                 LEFT JOIN entry e ON e.feed_id = f.id AND e.is_deleted = 0
                 GROUP BY f.id
                 ORDER BY f.title COLLATE NOCASE",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let per_feed: Vec<FeedCount> = stmt
            .query_map([], |row| {
                Ok(FeedCount {
                    feed_id: row.get(0)?,
                    title: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    unread: row.get::<_, usize>(2).unwrap_or(0),
                    total: row.get::<_, usize>(3).unwrap_or(0),
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(SidebarProjection {
            total_unread,
            total_starred,
            starred_unread,
            total_entries,
            total_feeds,
            per_feed,
        })
    })
}


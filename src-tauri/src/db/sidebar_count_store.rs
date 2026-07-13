use async_trait::async_trait;

use crate::error::AppError;

/// A per-feed unread count.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FeedUnreadCount {
    pub feed_id: i64,
    pub feed_title: String,
    pub unread_count: i64,
}

/// A per-tag unread count.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TagUnreadCount {
    pub tag_id: i64,
    pub tag_name: String,
    pub unread_count: i64,
}

/// Read-only queries for sidebar badge counts.
#[async_trait]
pub trait SidebarCountStore: Send + Sync {
    /// Total number of unread entries across all feeds.
    async fn total_unread(&self) -> Result<i64, AppError>;

    /// Number of unread entries per feed.
    async fn unread_by_feed(&self) -> Result<Vec<FeedUnreadCount>, AppError>;

    /// Number of unread entries per tag.
    async fn unread_by_tag(&self) -> Result<Vec<TagUnreadCount>, AppError>;

    /// Total number of starred entries across all feeds.
    async fn total_starred(&self) -> Result<i64, AppError>;

    /// Number of starred entries that are also unread.
    async fn starred_unread(&self) -> Result<i64, AppError>;
}

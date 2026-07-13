use async_trait::async_trait;

use crate::db::models::EntryListItem;
use crate::db::query_builder::{EntryListQuery, EntryPage, PageCursor};
use crate::error::AppError;

/// Persistence operations for feed entries (articles).
#[async_trait]
pub trait EntryStore: Send + Sync {
    /// Load a page of entries matching the given query.
    async fn load_page(&self, query: EntryListQuery) -> Result<EntryPage, AppError>;

    /// Load the next page of entries after the given cursor.
    async fn load_next_page(&self, cursor: PageCursor) -> Result<EntryPage, AppError>;

    /// Mark or unmark entries as read.
    async fn mark_read(&self, ids: &[i64], is_read: bool) -> Result<(), AppError>;

    /// Mark or unmark a single entry as starred.
    async fn mark_starred(&self, id: i64, is_starred: bool) -> Result<(), AppError>;

    /// Soft-delete an entry (sets is_deleted = true).
    async fn delete_entry(&self, id: i64) -> Result<(), AppError>;

    /// Full-text search across entry titles and summaries.
    async fn search(&self, text: &str, scope: SearchScope) -> Result<Vec<EntryListItem>, AppError>;
}

/// Defines which fields are searched.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum SearchScope {
    /// Search entry title only.
    TitleOnly,
    /// Search title and summary.
    TitleAndSummary,
    /// Search title, summary, and full content (if available).
    TitleSummaryContent,
}

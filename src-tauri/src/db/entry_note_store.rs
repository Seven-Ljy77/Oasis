use async_trait::async_trait;

use crate::db::models::EntryNote;
use crate::error::AppError;

/// Persistence operations for user-authored entry notes.
#[async_trait]
pub trait EntryNoteStore: Send + Sync {
    /// Load the note attached to an entry, if any.
    async fn load(&self, entry_id: i64) -> Result<Option<EntryNote>, AppError>;

    /// Insert or update the note for an entry.
    async fn upsert(&self, entry_id: i64, markdown_text: &str) -> Result<(), AppError>;

    /// Delete the note attached to an entry.
    async fn delete(&self, entry_id: i64) -> Result<(), AppError>;
}

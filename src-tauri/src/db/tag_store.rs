use async_trait::async_trait;

use crate::db::models::{EntryTag, Tag};
use crate::error::AppError;

/// Persistence operations for the tag library and entry-tag associations.
#[async_trait]
pub trait TagStore: Send + Sync {
    /// Load all tags ordered by name.
    async fn load_all(&self) -> Result<Vec<Tag>, AppError>;

    /// Create a new tag. Returns the created tag with its assigned id.
    async fn create(&self, name: &str) -> Result<Tag, AppError>;

    /// Rename an existing tag.
    async fn rename(&self, id: i64, new_name: &str) -> Result<Tag, AppError>;

    /// Delete a tag and remove all of its entry associations.
    async fn delete(&self, id: i64) -> Result<(), AppError>;

    /// Merge `source_id` into `target_id`: re-assign all entries from the
    /// source tag to the target, then delete the source tag.
    async fn merge(&self, source_id: i64, target_id: i64) -> Result<(), AppError>;

    /// Assign a tag to an entry, recording the source of the assignment.
    async fn assign_to_entry(
        &self,
        entry_id: i64,
        tag_id: i64,
        source: &str,
    ) -> Result<(), AppError>;

    /// Remove a tag from an entry.
    async fn remove_from_entry(&self, entry_id: i64, tag_id: i64) -> Result<(), AppError>;

    /// Load all tags associated with an entry.
    async fn load_by_entry(&self, entry_id: i64) -> Result<Vec<EntryTag>, AppError>;
}

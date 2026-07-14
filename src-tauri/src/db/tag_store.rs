use std::sync::Arc;

use async_trait::async_trait;
use rusqlite::params;

use crate::db::manager::DatabaseManager;
use crate::db::models::{EntryTag, Tag, TagAlias};
use crate::error::AppError;
use crate::tags::normalization::normalize_tag;

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

    /// Add an alias for a tag.
    async fn add_alias(&self, tag_id: i64, alias: &str) -> Result<TagAlias, AppError>;

    /// Delete a tag alias by its id.
    async fn delete_alias(&self, alias_id: i64) -> Result<(), AppError>;

    /// Load all aliases for a tag.
    async fn load_aliases(&self, tag_id: i64) -> Result<Vec<TagAlias>, AppError>;

    /// Load aliases for all tags (returns Vec of (tag_id, alias_name)).
    async fn load_all_aliases(&self) -> Result<Vec<(i64, String)>, AppError>;

    /// Load a single tag by id.
    async fn load_by_id(&self, id: i64) -> Result<Tag, AppError>;
}

/// Helper: try to fetch a single row and return None if no row matches.
fn query_optional<T>(
    conn: &rusqlite::Connection,
    sql: &str,
    params: &[&dyn rusqlite::types::ToSql],
    mapper: impl FnOnce(&rusqlite::Row<'_>) -> rusqlite::Result<T>,
) -> Result<Option<T>, AppError> {
    match conn.query_row(sql, params, mapper) {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::Database(e.to_string())),
    }
}

/// SQLite-backed implementation of TagStore.
pub struct SqliteTagStore {
    db: Arc<DatabaseManager>,
}

impl SqliteTagStore {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }

    /// Update usage_count based on actual entry_tag rows for a tag.
    fn refresh_usage_count(conn: &rusqlite::Connection, tag_id: i64) -> Result<(), AppError> {
        conn.execute(
            "UPDATE tag SET usage_count = (SELECT COUNT(*) FROM entry_tag WHERE tag_id = ?1) WHERE id = ?1",
            params![tag_id],
        )?;
        Ok(())
    }

    /// Determine if a tag should still be provisional based on usage_count.
    fn update_provisional(conn: &rusqlite::Connection, tag_id: i64) -> Result<(), AppError> {
        conn.execute(
            "UPDATE tag SET is_provisional = CASE WHEN usage_count >= 2 THEN 0 ELSE is_provisional END WHERE id = ?1",
            params![tag_id],
        )?;
        Ok(())
    }

    fn map_row_to_tag(row: &rusqlite::Row<'_>) -> rusqlite::Result<Tag> {
        Ok(Tag {
            id: row.get(0)?,
            name: row.get(1)?,
            normalized_name: row.get(2)?,
            is_provisional: row.get::<_, i32>(3)? != 0,
            usage_count: row.get(4)?,
        })
    }
}

#[async_trait]
impl TagStore for SqliteTagStore {
    async fn load_all(&self) -> Result<Vec<Tag>, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT id, name, normalized_name, is_provisional, usage_count FROM tag ORDER BY name",
                )?;
                let tags = stmt
                    .query_map([], Self::map_row_to_tag)?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(tags)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn load_by_id(&self, id: i64) -> Result<Tag, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                conn.query_row(
                    "SELECT id, name, normalized_name, is_provisional, usage_count FROM tag WHERE id = ?1",
                    params![id],
                    Self::map_row_to_tag,
                )
                .map_err(|e| AppError::Database(e.to_string()))
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn create(&self, name: &str) -> Result<Tag, AppError> {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err(AppError::InvalidInput("Tag name cannot be empty".into()));
        }
        let normalized = normalize_tag(&name);

        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                // Check for duplicate normalized name
                let existing = query_optional(
                    conn,
                    "SELECT id FROM tag WHERE normalized_name = ?1",
                    &[&normalized],
                    |row| row.get::<_, i64>(0),
                )?;

                if let Some(id) = existing {
                    // Return existing tag
                    conn.query_row(
                        "SELECT id, name, normalized_name, is_provisional, usage_count FROM tag WHERE id = ?1",
                        params![id],
                        Self::map_row_to_tag,
                    )
                    .map_err(|e| AppError::Database(e.to_string()))
                } else {
                    conn.execute(
                        "INSERT INTO tag (name, normalized_name, is_provisional, usage_count) VALUES (?1, ?2, 1, 0)",
                        params![name, normalized],
                    )?;
                    let id = conn.last_insert_rowid();
                    Ok(Tag {
                        id,
                        name,
                        normalized_name: normalized,
                        is_provisional: true,
                        usage_count: 0,
                    })
                }
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn rename(&self, id: i64, new_name: &str) -> Result<Tag, AppError> {
        let new_name = new_name.trim().to_string();
        if new_name.is_empty() {
            return Err(AppError::InvalidInput("Tag name cannot be empty".into()));
        }
        let normalized = normalize_tag(&new_name);

        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                // Check for duplicate
                let conflict = query_optional(
                    conn,
                    "SELECT id FROM tag WHERE normalized_name = ?1 AND id != ?2",
                    &[&normalized, &id],
                    |row| row.get::<_, i64>(0),
                )?;

                if conflict.is_some() {
                    return Err(AppError::InvalidInput(
                        "A tag with this name already exists".into(),
                    ));
                }

                conn.execute(
                    "UPDATE tag SET name = ?1, normalized_name = ?2 WHERE id = ?3",
                    params![new_name, normalized, id],
                )?;

                conn.query_row(
                    "SELECT id, name, normalized_name, is_provisional, usage_count FROM tag WHERE id = ?1",
                    params![id],
                    Self::map_row_to_tag,
                )
                .map_err(|e| AppError::Database(e.to_string()))
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn delete(&self, id: i64) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                // Delete cascades: entry_tag and tag_alias rows are removed via FK ON DELETE CASCADE
                conn.execute("DELETE FROM tag WHERE id = ?1", params![id])?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn merge(&self, source_id: i64, target_id: i64) -> Result<(), AppError> {
        if source_id == target_id {
            return Err(AppError::InvalidInput(
                "Cannot merge a tag into itself".into(),
            ));
        }

        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                // Move all entry_tag associations from source to target, ignoring duplicates
                conn.execute(
                    "INSERT OR IGNORE INTO entry_tag (entry_id, tag_id, source, confidence)
                     SELECT entry_id, ?1, 'manual', NULL FROM entry_tag WHERE tag_id = ?2",
                    params![target_id, source_id],
                )?;

                // Delete the source tag (cascades to entry_tag rows for source_id)
                conn.execute("DELETE FROM tag WHERE id = ?1", params![source_id])?;

                // Update usage counts
                Self::refresh_usage_count(conn, target_id)?;
                Self::update_provisional(conn, target_id)?;

                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn assign_to_entry(
        &self,
        entry_id: i64,
        tag_id: i64,
        source: &str,
    ) -> Result<(), AppError> {
        let source = source.to_string();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "INSERT OR IGNORE INTO entry_tag (entry_id, tag_id, source) VALUES (?1, ?2, ?3)",
                    params![entry_id, tag_id, source],
                )?;

                // Update usage_count and provisional status
                Self::refresh_usage_count(conn, tag_id)?;
                Self::update_provisional(conn, tag_id)?;

                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn remove_from_entry(&self, entry_id: i64, tag_id: i64) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "DELETE FROM entry_tag WHERE entry_id = ?1 AND tag_id = ?2",
                    params![entry_id, tag_id],
                )?;

                // Update usage_count
                Self::refresh_usage_count(conn, tag_id)?;

                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn load_by_entry(&self, entry_id: i64) -> Result<Vec<EntryTag>, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT entry_id, tag_id, source, confidence FROM entry_tag WHERE entry_id = ?1",
                )?;
                let tags = stmt
                    .query_map(params![entry_id], |row| {
                        Ok(EntryTag {
                            entry_id: row.get(0)?,
                            tag_id: row.get(1)?,
                            source: row.get(2)?,
                            confidence: row.get(3)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(tags)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn add_alias(&self, tag_id: i64, alias: &str) -> Result<TagAlias, AppError> {
        let alias = alias.trim().to_string();
        if alias.is_empty() {
            return Err(AppError::InvalidInput("Alias cannot be empty".into()));
        }
        let normalized_alias = normalize_tag(&alias);

        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                // Verify the tag exists
                conn.query_row("SELECT id FROM tag WHERE id = ?1", params![tag_id], |_row| Ok(()))
                    .map_err(|_| AppError::NotFound("Tag not found".into()))?;

                // Check for duplicate alias
                let existing = query_optional(
                    conn,
                    "SELECT id FROM tag_alias WHERE normalized_alias = ?1",
                    &[&normalized_alias],
                    |row| row.get::<_, i64>(0),
                )?;

                if let Some(alias_id) = existing {
                    return conn
                        .query_row(
                            "SELECT id, tag_id, alias, normalized_alias FROM tag_alias WHERE id = ?1",
                            params![alias_id],
                            |row| {
                                Ok(TagAlias {
                                    id: row.get(0)?,
                                    tag_id: row.get(1)?,
                                    alias: row.get(2)?,
                                    normalized_alias: row.get(3)?,
                                })
                            },
                        )
                        .map_err(|e| AppError::Database(e.to_string()));
                }

                conn.execute(
                    "INSERT INTO tag_alias (tag_id, alias, normalized_alias) VALUES (?1, ?2, ?3)",
                    params![tag_id, alias, normalized_alias],
                )?;
                let id = conn.last_insert_rowid();

                Ok(TagAlias {
                    id,
                    tag_id,
                    alias,
                    normalized_alias,
                })
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn delete_alias(&self, alias_id: i64) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute("DELETE FROM tag_alias WHERE id = ?1", params![alias_id])?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn load_aliases(&self, tag_id: i64) -> Result<Vec<TagAlias>, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT id, tag_id, alias, normalized_alias FROM tag_alias WHERE tag_id = ?1 ORDER BY alias",
                )?;
                let aliases = stmt
                    .query_map(params![tag_id], |row| {
                        Ok(TagAlias {
                            id: row.get(0)?,
                            tag_id: row.get(1)?,
                            alias: row.get(2)?,
                            normalized_alias: row.get(3)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(aliases)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn load_all_aliases(&self) -> Result<Vec<(i64, String)>, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT tag_id, alias FROM tag_alias ORDER BY tag_id, alias",
                )?;
                let aliases = stmt
                    .query_map([], |row| {
                        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(aliases)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }
}

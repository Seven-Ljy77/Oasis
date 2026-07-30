use std::sync::Arc;

use async_trait::async_trait;
use rusqlite::params;
use rusqlite::OptionalExtension;

use crate::db::manager::DatabaseManager;
use crate::db::models::EntryListItem;
use crate::db::query_builder::{EntryListQuery, EntryPage, PageCursor, TagMatchMode};
use crate::error::AppError;

/// Persistence operations for feed entries (articles).
#[async_trait]
pub trait EntryStore: Send + Sync {
    /// Load a page of entries matching the given query.
    async fn load_page(&self, query: EntryListQuery) -> Result<EntryPage, AppError>;

    /// Mark or unmark entries as read.
    async fn mark_read(&self, ids: &[i64], is_read: bool) -> Result<(), AppError>;

    /// Mark or unmark a single entry as starred.
    async fn mark_starred(&self, id: i64, is_starred: bool) -> Result<(), AppError>;

    /// Soft-delete an entry (sets is_deleted = true).
    async fn delete_entry(&self, id: i64) -> Result<(), AppError>;

    /// Load a single entry by its id.
    async fn load_by_id(&self, id: i64) -> Result<Option<EntryListItem>, AppError>;

    /// Full-text search across entry titles and summaries.
    async fn search(&self, text: &str, scope: SearchScope) -> Result<Vec<EntryListItem>, AppError>;

    /// Insert or ignore parsed entries from a feed sync.
    async fn upsert_entries(&self, feed_id: i64, entries: &[EntryUpsertData]) -> Result<usize, AppError>;

    /// Mark ALL entries matching the query as read or unread (query-scoped, not page-scoped).
    async fn mark_all_read(&self, query: &EntryListQuery, is_read: bool) -> Result<u64, AppError>;

    /// Soft-delete ALL entries matching the query (query-scoped).
    async fn delete_all_entries(&self, query: &EntryListQuery) -> Result<u64, AppError>;
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

/// Data needed to upsert a single entry during feed sync.
#[derive(Debug, Clone)]
pub struct EntryUpsertData {
    pub guid: Option<String>,
    pub url: Option<String>,
    pub title: Option<String>,
    pub author: Option<String>,
    pub published_at: Option<String>,
    pub summary: Option<String>,
}

/// SQLite-backed implementation of EntryStore.
pub struct SqliteEntryStore {
    db: Arc<DatabaseManager>,
}

impl SqliteEntryStore {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }
}

/// The SELECT column list for entry list items (joined with feed for feed_title).
const ENTRY_LIST_COLS: &str =
    "e.id, e.feed_id, e.title, e.author, e.url, e.published_at, e.summary, e.is_read, e.is_starred, f.title AS feed_title, e.created_at";

/// Base FROM clause joining entry with feed.
const ENTRY_FROM: &str = "FROM entry e JOIN feed f ON e.feed_id = f.id";

/// Build a dynamic WHERE clause for an EntryListQuery.
/// Returns (sql_fragment, param_values).
fn build_where_clause(query: &EntryListQuery) -> (String, Vec<Box<dyn rusqlite::types::ToSql>>) {
    let mut conditions = vec!["e.is_deleted = 0".to_string()];
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(feed_id) = query.feed_id {
        conditions.push(format!("e.feed_id = ?{}", param_values.len() + 1));
        param_values.push(Box::new(feed_id));
    }

    if query.unread_only {
        conditions.push("e.is_read = 0".to_string());
    }

    if query.starred_only {
        conditions.push("e.is_starred = 1".to_string());
    }

    if let Some(ref text) = query.search_text {
        let like = format!("%{}%", text);
        conditions.push(format!(
            "(e.title LIKE ?{} OR e.summary LIKE ?{})",
            param_values.len() + 1,
            param_values.len() + 2
        ));
        param_values.push(Box::new(like.clone()));
        param_values.push(Box::new(like));
    }

    if !query.tag_ids.is_empty() {
        let placeholders: Vec<String> = query
            .tag_ids
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", param_values.len() + i + 1))
            .collect();
        let placeholder_str = placeholders.join(", ");

        match query.tag_match_mode {
            TagMatchMode::All => {
                conditions.push(format!(
                    "e.id IN (SELECT entry_id FROM entry_tag WHERE tag_id IN ({}) GROUP BY entry_id HAVING COUNT(DISTINCT tag_id) = {})",
                    placeholder_str,
                    query.tag_ids.len()
                ));
            }
            TagMatchMode::Any => {
                conditions.push(format!(
                    "e.id IN (SELECT DISTINCT entry_id FROM entry_tag WHERE tag_id IN ({}))",
                    placeholder_str
                ));
            }
        }

        for tag_id in &query.tag_ids {
            param_values.push(Box::new(*tag_id));
        }
    }

    // Keyset cursor: (published_at, created_at, id) tuple comparison
    if let Some(ref cursor) = query.cursor {
        if let Some(ref published_at) = cursor.published_at {
            let p = param_values.len() + 1;
            let c = param_values.len() + 2;
            let i = param_values.len() + 3;
            conditions.push(format!(
                "(e.published_at IS NULL OR e.published_at < ?{p} OR \
                 (e.published_at = ?{p} AND e.created_at < ?{c}) OR \
                 (e.published_at = ?{p} AND e.created_at = ?{c} AND e.id < ?{i}))",
            ));
            param_values.push(Box::new(published_at.clone()));
            param_values.push(Box::new(cursor.created_at.clone()));
            param_values.push(Box::new(cursor.id));
        } else {
            let c = param_values.len() + 1;
            let i = param_values.len() + 2;
            conditions.push(format!(
                "(e.published_at IS NULL AND \
                 (e.created_at < ?{c} OR \
                 (e.created_at = ?{c} AND e.id < ?{i})))",
            ));
            param_values.push(Box::new(cursor.created_at.clone()));
            param_values.push(Box::new(cursor.id));
        }
    }

    let where_clause = conditions.join(" AND ");
    (format!("WHERE {}", where_clause), param_values)
}

/// Convert dynamic params to a slice of trait object references for rusqlite.
fn params_from_vec(
    v: &[Box<dyn rusqlite::types::ToSql>],
) -> Vec<&dyn rusqlite::types::ToSql> {
    v.iter().map(|p| p.as_ref()).collect()
}

#[async_trait]
impl EntryStore for SqliteEntryStore {
    async fn load_page(&self, query: EntryListQuery) -> Result<EntryPage, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let (where_clause, param_values) = build_where_clause(&query);
                let limit = query.limit.max(1) as i64;

                let sql = format!(
                    "SELECT {} {} {} ORDER BY e.published_at DESC, e.created_at DESC, e.id DESC LIMIT ?{}",
                    ENTRY_LIST_COLS,
                    ENTRY_FROM,
                    where_clause,
                    param_values.len() + 1,
                );

                let mut stmt = conn.prepare(&sql)?;
                let mut all_params = params_from_vec(&param_values);
                let limit_box = Box::new(limit);
                all_params.push(limit_box.as_ref());

                let entries: Vec<EntryListItem> = stmt
                    .query_map(all_params.as_slice(), |row| {
                        Ok(EntryListItem {
                            id: row.get(0)?,
                            feed_id: row.get(1)?,
                            title: row.get(2)?,
                            author: row.get(3)?,
                            url: row.get(4)?,
                            published_at: row.get(5)?,
                            summary: row.get(6)?,
                            is_read: row.get(7)?,
                            is_starred: row.get(8)?,
                            feed_title: row.get(9)?,
                            created_at: row.get(10)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;

                // Build next_cursor from the last entry if we have a full page
                let next_cursor = if entries.len() == query.limit as usize {
                    entries.last().map(|e| PageCursor {
                        published_at: e.published_at.clone(),
                        created_at: e.created_at.clone(),
                        id: e.id,
                    })
                } else {
                    None
                };

                Ok(EntryPage { entries, next_cursor })
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn mark_read(&self, ids: &[i64], is_read: bool) -> Result<(), AppError> {
        if ids.is_empty() {
            return Ok(());
        }

        let ids_vec = ids.to_vec();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                let placeholders: Vec<String> =
                    (0..ids_vec.len()).map(|i| format!("?{}", i + 1)).collect();
                let sql = format!(
                    "UPDATE entry SET is_read = ?{} WHERE id IN ({})",
                    ids_vec.len() + 1,
                    placeholders.join(", "),
                );
                let mut stmt = conn.prepare(&sql)?;

                let mut param_refs: Vec<&dyn rusqlite::types::ToSql> = Vec::new();
                let is_read_val: Box<dyn rusqlite::types::ToSql> = Box::new(if is_read { 1i64 } else { 0i64 });
                let id_boxes: Vec<Box<dyn rusqlite::types::ToSql>> =
                    ids_vec.iter().map(|id| Box::new(*id) as Box<dyn rusqlite::types::ToSql>).collect();

                for id_box in &id_boxes {
                    param_refs.push(id_box.as_ref());
                }
                param_refs.push(is_read_val.as_ref());

                stmt.execute(param_refs.as_slice())?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn mark_starred(&self, id: i64, is_starred: bool) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "UPDATE entry SET is_starred = ?1 WHERE id = ?2",
                    params![is_starred as i64, id],
                )?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn delete_entry(&self, id: i64) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "UPDATE entry SET is_deleted = 1 WHERE id = ?1",
                    params![id],
                )?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn load_by_id(&self, id: i64) -> Result<Option<EntryListItem>, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let sql = format!(
                    "SELECT {} {} WHERE e.id = ?1 AND e.is_deleted = 0",
                    ENTRY_LIST_COLS, ENTRY_FROM,
                );
                let result = conn
                    .query_row(&sql, params![id], |row| {
                        Ok(EntryListItem {
                            id: row.get(0)?,
                            feed_id: row.get(1)?,
                            title: row.get(2)?,
                            author: row.get(3)?,
                            url: row.get(4)?,
                            published_at: row.get(5)?,
                            summary: row.get(6)?,
                            is_read: row.get(7)?,
                            is_starred: row.get(8)?,
                            feed_title: row.get(9)?,
                            created_at: row.get(10)?,
                        })
                    })
                    .optional();
                match result {
                    Ok(opt) => Ok(opt),
                    Err(e) => Err(AppError::Database(e.to_string())),
                }
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn search(&self, text: &str, scope: SearchScope) -> Result<Vec<EntryListItem>, AppError> {
        let text = text.to_string();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let like = format!("%{}%", text);

                let search_condition = match scope {
                    SearchScope::TitleOnly => "e.title LIKE ?1".to_string(),
                    SearchScope::TitleAndSummary => {
                        "(e.title LIKE ?1 OR e.summary LIKE ?1)".to_string()
                    }
                    SearchScope::TitleSummaryContent => {
                        // Also search the content table for full-text matches
                        "(e.title LIKE ?1 OR e.summary LIKE ?1 OR e.id IN (SELECT entry_id FROM content WHERE markdown LIKE ?1))".to_string()
                    }
                };

                let sql = format!(
                    "SELECT {} {} WHERE e.is_deleted = 0 AND {} ORDER BY e.published_at DESC LIMIT 100",
                    ENTRY_LIST_COLS, ENTRY_FROM, search_condition,
                );

                let mut stmt = conn.prepare(&sql)?;
                let entries = stmt
                    .query_map(params![like], |row| {
                        Ok(EntryListItem {
                            id: row.get(0)?,
                            feed_id: row.get(1)?,
                            title: row.get(2)?,
                            author: row.get(3)?,
                            url: row.get(4)?,
                            published_at: row.get(5)?,
                            summary: row.get(6)?,
                            is_read: row.get(7)?,
                            is_starred: row.get(8)?,
                            feed_title: row.get(9)?,
                            created_at: row.get(10)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(entries)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn upsert_entries(
        &self,
        feed_id: i64,
        entries: &[EntryUpsertData],
    ) -> Result<usize, AppError> {
        let entries: Vec<EntryUpsertData> = entries.to_vec();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                let now = chrono::Utc::now().to_rfc3339();
                let mut count = 0usize;

                let mut stmt = conn.prepare(
                    "INSERT INTO entry (feed_id, guid, url, title, author, published_at, summary, is_read, is_starred, is_deleted, created_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 0, 0, ?8) \
                     ON CONFLICT(feed_id, guid) DO UPDATE SET \
                        url = excluded.url, \
                        title = excluded.title, \
                        author = excluded.author, \
                        published_at = excluded.published_at, \
                        summary = excluded.summary, \
                        is_deleted = 0",
                )?;

                for entry in &entries {
                    let changes = stmt.execute(params![
                        feed_id,
                        entry.guid,
                        entry.url,
                        entry.title,
                        entry.author,
                        entry.published_at,
                        entry.summary,
                        now,
                    ])?;
                    count += changes;
                }
                Ok(count)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn mark_all_read(&self, query: &EntryListQuery, is_read: bool) -> Result<u64, AppError> {
        let query = query.clone();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                let (where_clause, mut param_values) = build_where_clause(&query);
                let read_parameter = param_values.len() + 1;
                param_values.push(Box::new(is_read));
                let param_refs = params_from_vec(&param_values);

                let sql = format!(
                    "UPDATE entry SET is_read = ?{read_parameter} \
                     WHERE id IN (SELECT e.id FROM entry e {where_clause})"
                );
                let rows = conn
                    .execute(&sql, &param_refs[..])
                    .map_err(|e| AppError::Database(e.to_string()))? as u64;
                Ok(rows)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn delete_all_entries(&self, query: &EntryListQuery) -> Result<u64, AppError> {
        let query = query.clone();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                let (where_clause, param_values) = build_where_clause(&query);
                let param_refs = params_from_vec(&param_values);

                let sql = format!(
                    "UPDATE entry SET is_deleted = 1 WHERE id IN (SELECT e.id FROM entry e {})",
                    where_clause
                );
                let rows = conn
                    .execute(&sql, &param_refs[..])
                    .map_err(|e| AppError::Database(e.to_string()))? as u64;
                Ok(rows)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::{EntryStore, SqliteEntryStore};
    use crate::db::manager::DatabaseManager;
    use crate::db::query_builder::EntryListQuery;

    #[tokio::test]
    async fn keyset_pagination_preserves_filters_and_handles_null_dates() {
        let path =
            std::env::temp_dir().join(format!("oasis-entries-{}.db", uuid::Uuid::new_v4()));

        {
            let db = Arc::new(DatabaseManager::new(&path).unwrap());
            db.write(|conn| {
                conn.execute_batch(
                    "INSERT INTO feed (id, title, feed_url) VALUES
                         (1, 'One', 'https://one.example/feed'),
                         (2, 'Two', 'https://two.example/feed');
                     INSERT INTO entry
                         (id, feed_id, guid, title, published_at, created_at) VALUES
                         (1, 1, 'a', 'A', '2024-03-01', '2024-03-01'),
                         (2, 1, 'b', 'B', '2024-02-01', '2024-02-01'),
                         (3, 1, 'c', 'C', NULL, '2024-01-03'),
                         (4, 1, 'd', 'D', NULL, '2024-01-02'),
                         (5, 1, 'e', 'E', NULL, '2024-01-01'),
                         (6, 2, 'other', 'Other', '2025-01-01', '2025-01-01');",
                )?;
                Ok(())
            })
            .unwrap();

            let store = SqliteEntryStore::new(db.clone());
            let mut query = EntryListQuery {
                feed_id: Some(1),
                limit: 2,
                ..EntryListQuery::default()
            };

            let first = store.load_page(query.clone()).await.unwrap();
            assert_eq!(
                first.entries.iter().map(|entry| entry.id).collect::<Vec<_>>(),
                vec![1, 2]
            );

            query.cursor = first.next_cursor;
            let second = store.load_page(query.clone()).await.unwrap();
            assert_eq!(
                second
                    .entries
                    .iter()
                    .map(|entry| entry.id)
                    .collect::<Vec<_>>(),
                vec![3, 4]
            );
            assert!(second.next_cursor.as_ref().unwrap().published_at.is_none());

            query.cursor = second.next_cursor;
            let third = store.load_page(query).await.unwrap();
            assert_eq!(
                third.entries.iter().map(|entry| entry.id).collect::<Vec<_>>(),
                vec![5]
            );
            assert!(third.next_cursor.is_none());
            assert!(
                first
                    .entries
                    .iter()
                    .chain(second.entries.iter())
                    .chain(third.entries.iter())
                    .all(|entry| entry.feed_id == 1)
            );

            let marked = store
                .mark_all_read(
                    &EntryListQuery {
                        feed_id: Some(1),
                        ..EntryListQuery::default()
                    },
                    true,
                )
                .await
                .unwrap();
            assert_eq!(marked, 5);
            let (selected_read, other_read): (i64, i64) = db
                .read(|conn| {
                    Ok((
                        conn.query_row(
                            "SELECT COUNT(*) FROM entry WHERE feed_id = 1 AND is_read = 1",
                            [],
                            |row| row.get(0),
                        )?,
                        conn.query_row(
                            "SELECT COUNT(*) FROM entry WHERE feed_id = 2 AND is_read = 1",
                            [],
                            |row| row.get(0),
                        )?,
                    ))
                })
                .unwrap();
            assert_eq!(selected_read, 5);
            assert_eq!(other_read, 0);
        }

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(path.with_extension("db-shm"));
        let _ = std::fs::remove_file(path.with_extension("db-wal"));
    }
}

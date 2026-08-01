use std::sync::Arc;

use async_trait::async_trait;
use rusqlite::params;
use rusqlite::OptionalExtension;

use crate::db::manager::DatabaseManager;
use crate::db::models::SummaryResult;
use crate::error::AppError;

/// Persistence operations for AI-generated summaries.
#[async_trait]
pub trait SummaryStore: Send + Sync {
    /// Save a summary result (insert or replace by unique slot).
    async fn save(&self, result: &SummaryResult) -> Result<SummaryResult, AppError>;

    /// Load the summary for a specific (entry, language, detail_level) slot.
    async fn load_by_slot(
        &self,
        entry_id: i64,
        language: &str,
        detail_level: &str,
    ) -> Result<Option<SummaryResult>, AppError>;

    /// Load the most recently created summary for an entry (any language /
    /// detail level).
    async fn load_latest(&self, entry_id: i64) -> Result<Option<SummaryResult>, AppError>;

    /// Remove the summary for a specific slot.
    async fn clear(
        &self,
        entry_id: i64,
        language: &str,
        detail_level: &str,
    ) -> Result<(), AppError>;

    /// Evict the oldest summaries so that at most `max_count` remain.
    async fn evict(&self, max_count: u32) -> Result<(), AppError>;
}

// =============================================================================
// SQLite Implementation
// =============================================================================

pub struct SqliteSummaryStore {
    db: Arc<DatabaseManager>,
}

impl SqliteSummaryStore {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl SummaryStore for SqliteSummaryStore {
    async fn save(&self, result: &SummaryResult) -> Result<SummaryResult, AppError> {
        let r = result.clone();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "INSERT INTO summary_result \
                     (task_run_id, entry_id, target_language, detail_level, text, created_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, datetime('now')) \
                     ON CONFLICT(entry_id, target_language, detail_level) DO UPDATE SET \
                        task_run_id = excluded.task_run_id, \
                        text = excluded.text, \
                        created_at = datetime('now')",
                    params![
                        r.task_run_id,
                        r.entry_id,
                        r.target_language,
                        r.detail_level,
                        r.text,
                    ],
                )?;
                let id = conn.query_row(
                    "SELECT id FROM summary_result WHERE entry_id = ?1 AND target_language = ?2 AND detail_level = ?3",
                    params![r.entry_id, r.target_language, r.detail_level],
                    |row| row.get(0),
                )?;
                Ok(SummaryResult { id, ..r })
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn load_by_slot(
        &self,
        entry_id: i64,
        language: &str,
        detail_level: &str,
    ) -> Result<Option<SummaryResult>, AppError> {
        let lang = language.to_string();
        let detail = detail_level.to_string();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT id, task_run_id, entry_id, target_language, detail_level, text, created_at \
                     FROM summary_result \
                     WHERE entry_id = ?1 AND target_language = ?2 AND detail_level = ?3",
                )?;
                let result = stmt
                    .query_row(params![entry_id, lang, detail], |row| {
                        Ok(SummaryResult {
                            id: row.get(0)?,
                            task_run_id: row.get(1)?,
                            entry_id: row.get(2)?,
                            target_language: row.get(3)?,
                            detail_level: row.get(4)?,
                            text: row.get(5)?,
                            created_at: row.get(6)?,
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

    async fn load_latest(&self, entry_id: i64) -> Result<Option<SummaryResult>, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT id, task_run_id, entry_id, target_language, detail_level, text, created_at \
                     FROM summary_result \
                     WHERE entry_id = ?1 \
                     ORDER BY created_at DESC \
                     LIMIT 1",
                )?;
                let result = stmt
                    .query_row(params![entry_id], |row| {
                        Ok(SummaryResult {
                            id: row.get(0)?,
                            task_run_id: row.get(1)?,
                            entry_id: row.get(2)?,
                            target_language: row.get(3)?,
                            detail_level: row.get(4)?,
                            text: row.get(5)?,
                            created_at: row.get(6)?,
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

    async fn clear(
        &self,
        entry_id: i64,
        language: &str,
        detail_level: &str,
    ) -> Result<(), AppError> {
        let lang = language.to_string();
        let detail = detail_level.to_string();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "DELETE FROM summary_result \
                     WHERE entry_id = ?1 AND target_language = ?2 AND detail_level = ?3",
                    params![entry_id, lang, detail],
                )?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn evict(&self, max_count: u32) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "DELETE FROM summary_result WHERE id NOT IN \
                     (SELECT id FROM summary_result ORDER BY created_at DESC LIMIT ?1)",
                    params![max_count],
                )?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::{SqliteSummaryStore, SummaryStore};
    use crate::db::manager::DatabaseManager;
    use crate::db::models::SummaryResult;

    #[tokio::test]
    async fn saves_summary_without_task_run_and_keeps_slot_id_on_update() {
        let path =
            std::env::temp_dir().join(format!("oasis-summary-{}.db", uuid::Uuid::new_v4()));

        {
            let db = Arc::new(DatabaseManager::new(&path).unwrap());
            db.write(|conn| {
                conn.execute(
                    "INSERT INTO feed (title, feed_url) VALUES ('Feed', 'https://example.com/feed')",
                    [],
                )?;
                conn.execute(
                    "INSERT INTO entry (feed_id, guid, title) VALUES (1, 'entry-1', 'Entry')",
                    [],
                )?;
                Ok(())
            })
            .unwrap();

            let store = SqliteSummaryStore::new(db.clone());
            let first = store
                .save(&SummaryResult {
                    id: 0,
                    task_run_id: None,
                    entry_id: 1,
                    target_language: "en".to_string(),
                    detail_level: "medium".to_string(),
                    text: "First".to_string(),
                    created_at: String::new(),
                })
                .await
                .unwrap();
            let second = store
                .save(&SummaryResult {
                    text: "Second".to_string(),
                    ..first.clone()
                })
                .await
                .unwrap();

            assert_eq!(second.id, first.id);
            let loaded = store
                .load_by_slot(1, "en", "medium")
                .await
                .unwrap()
                .unwrap();
            assert_eq!(loaded.text, "Second");
            assert_eq!(loaded.task_run_id, None);
        }

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(path.with_extension("db-shm"));
        let _ = std::fs::remove_file(path.with_extension("db-wal"));
    }
}

use std::sync::Arc;

use async_trait::async_trait;
use rusqlite::params;
use rusqlite::OptionalExtension;

use crate::db::manager::DatabaseManager;
use crate::db::models::{TranslationResult, TranslationSegment};
use crate::error::AppError;

/// Persistence operations for AI-generated translations.
#[async_trait]
pub trait TranslationStore: Send + Sync {
    /// Save a partial translation checkpoint (results + segments). Used during
    /// streaming to persist progress incrementally.
    async fn save_checkpoint(
        &self,
        result: &TranslationResult,
        segments: &[TranslationSegment],
    ) -> Result<(), AppError>;

    /// Finalize a translation run: link the result to its task run and mark
    /// run_status as "succeeded".
    async fn finalize(&self, task_run_id: i64) -> Result<(), AppError>;

    /// Load the translation result and all of its segments for the given entry
    /// and target language.
    async fn load(
        &self,
        entry_id: i64,
        target_language: &str,
    ) -> Result<Option<(TranslationResult, Vec<TranslationSegment>)>, AppError>;

    /// Remove all translation data for the given (entry, language) slot.
    async fn clear(&self, entry_id: i64, target_language: &str) -> Result<(), AppError>;

    /// Evict the oldest translation results so that at most `max_count` remain.
    async fn evict(&self, max_count: u32) -> Result<(), AppError>;
}

// =============================================================================
// SQLite Implementation
// =============================================================================

pub struct SqliteTranslationStore {
    db: Arc<DatabaseManager>,
}

impl SqliteTranslationStore {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl TranslationStore for SqliteTranslationStore {
    async fn save_checkpoint(
        &self,
        result: &TranslationResult,
        segments: &[TranslationSegment],
    ) -> Result<(), AppError> {
        let r = result.clone();
        let segs = segments.to_vec();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                // Upsert translation_result
                // Try UPDATE first, then INSERT if no row affected
                let rows = conn.execute(
                    "UPDATE translation_result SET \
                        source_content_hash = ?3, segmenter_version = ?4, \
                        run_status = ?5, task_run_id = ?6 \
                     WHERE entry_id = ?1 AND target_language = ?2",
                    params![
                        r.entry_id, r.target_language,
                        r.source_content_hash, r.segmenter_version,
                        r.run_status, r.task_run_id,
                    ],
                )?;
                if rows == 0 {
                    conn.execute(
                        "INSERT INTO translation_result \
                         (entry_id, target_language, source_content_hash, segmenter_version, \
                          run_status, task_run_id, created_at) \
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))",
                        params![
                            r.entry_id, r.target_language,
                            r.source_content_hash, r.segmenter_version,
                            r.run_status, r.task_run_id,
                        ],
                    )?;
                }
                let result_id: i64 = if r.id != 0 {
                    r.id
                } else {
                    // Retrieve the id of the row we just inserted/updated
                    conn.query_row(
                        "SELECT id FROM translation_result WHERE entry_id = ?1 AND target_language = ?2",
                        params![r.entry_id, r.target_language],
                        |row| row.get(0),
                    )?
                };

                // Delete old segments for this result, then insert new ones
                conn.execute(
                    "DELETE FROM translation_segment WHERE translation_result_id = ?1",
                    params![result_id],
                )?;
                for seg in &segs {
                    conn.execute(
                        "INSERT INTO translation_segment \
                         (translation_result_id, segment_id, source_text, translated_text, \
                          order_index, status) \
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        params![
                            result_id,
                            seg.segment_id,
                            seg.source_text,
                            seg.translated_text,
                            seg.order_index,
                            seg.status,
                        ],
                    )?;
                }
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn finalize(&self, task_run_id: i64) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "UPDATE translation_result SET run_status = 'succeeded', task_run_id = ?1 \
                     WHERE task_run_id IS NULL OR task_run_id = ?1",
                    params![task_run_id],
                )?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn load(
        &self,
        entry_id: i64,
        target_language: &str,
    ) -> Result<Option<(TranslationResult, Vec<TranslationSegment>)>, AppError> {
        let lang = target_language.to_string();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT id, task_run_id, entry_id, target_language, source_content_hash, \
                     segmenter_version, run_status, created_at \
                     FROM translation_result \
                     WHERE entry_id = ?1 AND target_language = ?2 AND run_status = 'succeeded'",
                )?;
                let result = stmt.query_row(params![entry_id, lang], |row| {
                    Ok(TranslationResult {
                        id: row.get(0)?,
                        task_run_id: row.get(1)?,
                        entry_id: row.get(2)?,
                        target_language: row.get(3)?,
                        source_content_hash: row.get(4)?,
                        segmenter_version: row.get(5)?,
                        run_status: row.get(6)?,
                        created_at: row.get(7)?,
                    })
                }).optional();
                match result {
                    Ok(Some(tr)) => {
                        let mut seg_stmt = conn.prepare(
                            "SELECT id, translation_result_id, segment_id, source_text, \
                             translated_text, order_index, status \
                             FROM translation_segment \
                             WHERE translation_result_id = ?1 \
                             ORDER BY order_index",
                        )?;
                        let segments: Vec<TranslationSegment> = seg_stmt
                            .query_map(params![tr.id], |row| {
                                Ok(TranslationSegment {
                                    id: row.get(0)?,
                                    translation_result_id: row.get(1)?,
                                    segment_id: row.get(2)?,
                                    source_text: row.get(3)?,
                                    translated_text: row.get(4)?,
                                    order_index: row.get(5)?,
                                    status: row.get(6)?,
                                })
                            })?
                            .collect::<Result<Vec<_>, _>>()?;
                        Ok(Some((tr, segments)))
                    }
                    Ok(None) => Ok(None),
                    Err(e) => Err(AppError::Database(e.to_string())),
                }
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn clear(&self, entry_id: i64, target_language: &str) -> Result<(), AppError> {
        let lang = target_language.to_string();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                // CASCADE deletes translation_segment rows automatically
                conn.execute(
                    "DELETE FROM translation_result WHERE entry_id = ?1 AND target_language = ?2",
                    params![entry_id, lang],
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
                    "DELETE FROM translation_result WHERE id NOT IN \
                     (SELECT id FROM translation_result ORDER BY created_at DESC LIMIT ?1)",
                    params![max_count],
                )?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }
}

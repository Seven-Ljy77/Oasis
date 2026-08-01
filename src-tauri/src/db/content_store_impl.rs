// =============================================================================
// Mercury — SqliteContentStore
//
// SQLite-backed implementation of the ContentStore trait. Stores and retrieves
// reader pipeline artifacts (source HTML, cleaned HTML, Markdown, rendered HTML
// cache) for the 5-tier rebuild-action cache hierarchy.
// =============================================================================

use std::sync::Arc;

use async_trait::async_trait;
use rusqlite::{OptionalExtension, params};

use crate::db::content_store::ContentStore;
use crate::db::manager::DatabaseManager;
use crate::db::models::{Content, ContentHTMLCache};
use crate::error::AppError;

pub struct SqliteContentStore {
    db: Arc<DatabaseManager>,
}

impl SqliteContentStore {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl ContentStore for SqliteContentStore {
    async fn load(&self, entry_id: i64) -> Result<Option<Content>, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                conn.query_row(
                    "SELECT id, entry_id, html, cleaned_html, readability_title, \
                     readability_byline, readability_version, markdown, markdown_version, \
                     display_mode, document_base_url, pipeline_type, \
                     resolved_intermediate_content, created_at \
                     FROM content WHERE entry_id = ?1",
                    params![entry_id],
                    |row| {
                        Ok(Content {
                            id: row.get(0)?,
                            entry_id: row.get(1)?,
                            html: row.get(2)?,
                            cleaned_html: row.get(3)?,
                            readability_title: row.get(4)?,
                            readability_byline: row.get(5)?,
                            readability_version: row.get(6)?,
                            markdown: row.get(7)?,
                            markdown_version: row.get(8)?,
                            display_mode: row.get(9)?,
                            document_base_url: row.get(10)?,
                            pipeline_type: row.get(11)?,
                            resolved_intermediate_content: row.get(12)?,
                            created_at: row.get(13)?,
                        })
                    },
                )
                .optional()
                .map_err(|e| AppError::Database(e.to_string()))
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn upsert_source(
        &self,
        entry_id: i64,
        html: &str,
        document_base_url: Option<&str>,
        pipeline_type: &str,
    ) -> Result<(), AppError> {
        let db = self.db.clone();
        let html_owned = html.to_string();
        let doc_url_owned = document_base_url.map(|s| s.to_string());
        let pt_owned = pipeline_type.to_string();

        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "INSERT INTO content (entry_id, html, document_base_url, pipeline_type) \
                     VALUES (?1, ?2, ?3, ?4) \
                     ON CONFLICT(entry_id) DO UPDATE SET \
                     html = excluded.html, \
                     document_base_url = excluded.document_base_url, \
                     pipeline_type = excluded.pipeline_type",
                    params![entry_id, html_owned, doc_url_owned, pt_owned],
                )
                .map_err(|e| AppError::Database(e.to_string()))?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn upsert_artifacts(
        &self,
        entry_id: i64,
        cleaned_html: Option<&str>,
        readability_title: Option<&str>,
        readability_byline: Option<&str>,
        readability_version: Option<i32>,
        markdown: Option<&str>,
        markdown_version: Option<i32>,
        display_mode: &str,
    ) -> Result<(), AppError> {
        let db = self.db.clone();
        let ch = cleaned_html.map(|s| s.to_string());
        let rt = readability_title.map(|s| s.to_string());
        let rb = readability_byline.map(|s| s.to_string());
        let md = markdown.map(|s| s.to_string());
        let dm = display_mode.to_string();

        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "INSERT INTO content (entry_id, cleaned_html, readability_title, \
                     readability_byline, readability_version, markdown, markdown_version, \
                     display_mode) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) \
                     ON CONFLICT(entry_id) DO UPDATE SET \
                     cleaned_html = excluded.cleaned_html, \
                     readability_title = excluded.readability_title, \
                     readability_byline = excluded.readability_byline, \
                     readability_version = excluded.readability_version, \
                     markdown = excluded.markdown, \
                     markdown_version = excluded.markdown_version, \
                     display_mode = excluded.display_mode",
                    params![
                        entry_id, ch, rt, rb, readability_version, md, markdown_version, dm,
                    ],
                )
                .map_err(|e| AppError::Database(e.to_string()))?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn invalidate_layer(&self, entry_id: i64, target: &str) -> Result<(), AppError> {
        let db = self.db.clone();
        let target_owned = target.to_string();

        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                match target_owned.as_str() {
                    "readability" => {
                        conn.execute(
                            "UPDATE content SET cleaned_html = NULL, readability_title = NULL, \
                             readability_byline = NULL, readability_version = NULL, \
                             markdown = NULL, markdown_version = NULL \
                             WHERE entry_id = ?1",
                            params![entry_id],
                        )?;
                        // Also clear the HTML cache since it depends on this layer.
                        conn.execute(
                            "DELETE FROM content_html_cache WHERE entry_id = ?1",
                            params![entry_id],
                        )?;
                    }
                    "markdown" => {
                        conn.execute(
                            "UPDATE content SET markdown = NULL, markdown_version = NULL \
                             WHERE entry_id = ?1",
                            params![entry_id],
                        )?;
                        conn.execute(
                            "DELETE FROM content_html_cache WHERE entry_id = ?1",
                            params![entry_id],
                        )?;
                    }
                    "all" => {
                        conn.execute(
                            "UPDATE content SET cleaned_html = NULL, readability_title = NULL, \
                             readability_byline = NULL, readability_version = NULL, \
                             markdown = NULL, markdown_version = NULL, html = NULL \
                             WHERE entry_id = ?1",
                            params![entry_id],
                        )?;
                        conn.execute(
                            "DELETE FROM content_html_cache WHERE entry_id = ?1",
                            params![entry_id],
                        )?;
                    }
                    _ => {}
                }
                Ok(())
            })
            .map_err(|e| AppError::Database(e.to_string()))
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn load_cache(
        &self,
        entry_id: i64,
        theme_id: &str,
    ) -> Result<Option<ContentHTMLCache>, AppError> {
        let db = self.db.clone();
        let tid = theme_id.to_string();

        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                conn.query_row(
                    "SELECT entry_id, theme_id, html, reader_render_version, updated_at \
                     FROM content_html_cache WHERE entry_id = ?1 AND theme_id = ?2",
                    params![entry_id, tid],
                    |row| {
                        Ok(ContentHTMLCache {
                            entry_id: row.get(0)?,
                            theme_id: row.get(1)?,
                            html: row.get(2)?,
                            reader_render_version: row.get(3)?,
                            updated_at: row.get(4)?,
                        })
                    },
                )
                .optional()
                .map_err(|e| AppError::Database(e.to_string()))
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }
}

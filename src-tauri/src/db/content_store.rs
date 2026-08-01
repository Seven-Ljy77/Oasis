use async_trait::async_trait;

use crate::db::models::{Content, ContentHTMLCache};
use crate::error::AppError;

/// Persistence operations for entry content and its reader pipeline artifacts.
#[async_trait]
pub trait ContentStore: Send + Sync {
    /// Load the content record for an entry.
    async fn load(&self, entry_id: i64) -> Result<Option<Content>, AppError>;

    /// Store the source HTML and initial pipeline metadata.
    async fn upsert_source(
        &self,
        entry_id: i64,
        html: &str,
        document_base_url: Option<&str>,
        pipeline_type: &str,
    ) -> Result<(), AppError>;

    /// Store post-pipeline artifacts (cleaned HTML, markdown, readability metadata).
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
    ) -> Result<(), AppError>;

    /// Invalidate a specific layer of the pipeline for an entry so it can be
    /// re-generated.  `target` is one of "readability", "markdown", or "all".
    async fn invalidate_layer(&self, entry_id: i64, target: &str) -> Result<(), AppError>;

    /// Load the rendered HTML cache for an entry + theme combination.
    async fn load_cache(
        &self,
        entry_id: i64,
        theme_id: &str,
    ) -> Result<Option<ContentHTMLCache>, AppError>;
}

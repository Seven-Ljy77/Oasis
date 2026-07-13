use crate::error::AppError;
use serde::{Deserialize, Serialize};

/// Rendered reader HTML ready for WebView display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReaderHTML {
    pub html: String,
    pub theme_fingerprint: String,
}

/// Rebuild action determined by pipeline inspection.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RebuildAction {
    ServeCached,
    RerenderFromMarkdown,
    RebuildMarkdownAndRender,
    RerunReadabilityAndRebuild,
    FetchAndRebuildFull,
}

/// Reader pipeline trait — defines the contract for content transformation.
pub trait ReaderPipeline: Send + Sync {
    fn rebuild_action(
        &self,
        cached_html_version: Option<i64>,
        has_cached_html: bool,
        markdown_version: Option<i64>,
        has_markdown: bool,
        readability_version: Option<i64>,
        has_cleaned_html: bool,
        has_source_html: bool,
    ) -> RebuildAction;

    fn build_markdown_from_source(
        &self,
        html: &str,
        base_url: &str,
    ) -> Result<String, AppError>;

    fn render_html(&self, markdown: &str, theme_css: &str) -> Result<String, AppError>;
}

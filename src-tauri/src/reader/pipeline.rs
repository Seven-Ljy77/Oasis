use crate::error::AppError;
use crate::reader::theme::ThemeTokens;
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

// =============================================================================
// DefaultReaderPipeline
// =============================================================================

/// The standard Mercury reader pipeline: fetch -> Markdown -> themed HTML.
pub struct DefaultReaderPipeline;

impl DefaultReaderPipeline {
    /// Run the full pipeline for an entry: fetch source HTML, convert to
    /// Markdown, and render into a themed reader HTML document.
    pub async fn build_html(
        &self,
        entry_url: &str,
        theme: &ThemeTokens,
    ) -> Result<ReaderHTML, AppError> {
        // 1. Fetch source HTML from the article URL.
        let html = crate::reader::readability::fetch_article_html(entry_url).await?;

        // 2. Convert HTML to Markdown.
        let markdown = crate::reader::markdown_converter::html_to_markdown(&html)?;

        // 3. Render Markdown to themed reader HTML.
        let reader_html =
            crate::reader::markdown_renderer::markdown_to_reader_html(&markdown, theme)?;

        Ok(ReaderHTML {
            html: reader_html,
            theme_fingerprint: String::new(),
        })
    }
}

impl ReaderPipeline for DefaultReaderPipeline {
    fn rebuild_action(
        &self,
        _cached_html_version: Option<i64>,
        has_cached_html: bool,
        _markdown_version: Option<i64>,
        _has_markdown: bool,
        _readability_version: Option<i64>,
        _has_cleaned_html: bool,
        _has_source_html: bool,
    ) -> RebuildAction {
        if has_cached_html {
            RebuildAction::ServeCached
        } else {
            RebuildAction::FetchAndRebuildFull
        }
    }

    fn build_markdown_from_source(
        &self,
        html: &str,
        _base_url: &str,
    ) -> Result<String, AppError> {
        crate::reader::markdown_converter::html_to_markdown(html)
    }

    fn render_html(&self, markdown: &str, _theme_css: &str) -> Result<String, AppError> {
        // Use default theme tokens when only a CSS string is provided.
        let theme = ThemeTokens::default();
        crate::reader::markdown_renderer::markdown_to_reader_html(markdown, &theme)
    }
}

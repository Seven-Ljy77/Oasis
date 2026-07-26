use crate::db::content_store::ContentStore;
use crate::error::AppError;
use crate::reader::theme::ThemeTokens;
use serde::{Deserialize, Serialize};

/// Current pipeline version numbers. Bump these when the corresponding
/// algorithm changes to trigger automatic cache invalidation.
pub struct PipelineVersions;

impl PipelineVersions {
    /// Version of the content extraction / readability algorithm.
    pub const READABILITY: i32 = crate::reader::readability::READABILITY_VERSION;
    /// Version of the HTML-to-Markdown converter.
    pub const MARKDOWN: i32 = 1;
}

/// Rendered reader HTML ready for WebView display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReaderHTML {
    pub html: String,
    pub theme_fingerprint: String,
}

/// Rebuild action determined by pipeline inspection.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RebuildAction {
    /// Final rendered HTML is already cached for the current theme.
    ServeCached,
    /// Markdown is cached and current — only need to re-render with theme.
    RerenderFromMarkdown,
    /// Cleaned HTML is cached and current — re-convert to Markdown, then render.
    RebuildMarkdownAndRender,
    /// Source HTML is cached — re-run readability, convert, and render.
    RerunReadabilityAndRebuild,
    /// Nothing useful is cached — fetch source HTML and run full pipeline.
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

/// The standard Mercury reader pipeline: fetch -> readability -> Markdown -> themed HTML.
pub struct DefaultReaderPipeline;

impl DefaultReaderPipeline {
    /// Run the full pipeline for an entry: fetch source HTML, extract content,
    /// convert to Markdown, and render into a themed reader HTML document.
    /// Does NOT persist intermediate artifacts — use `build_html_with_store`
    /// when caching to the database is desired.
    pub async fn build_html(
        &self,
        entry_url: &str,
        theme: &ThemeTokens,
    ) -> Result<ReaderHTML, AppError> {
        // 1. Fetch source HTML from the article URL.
        let raw_html = crate::reader::readability::fetch_article_html(entry_url).await?;

        // 2. Extract main article content (Readability-style cleaning).
        let cleaned = crate::reader::readability::extract_article_content(&raw_html)?;

        // 3. Convert cleaned HTML to Markdown.
        let markdown =
            crate::reader::markdown_converter::html_to_markdown(&cleaned.content_html)?;

        // 4. Render Markdown to themed reader HTML.
        let reader_html =
            crate::reader::markdown_renderer::markdown_to_reader_html(&markdown, theme, Some(entry_url))?;

        Ok(ReaderHTML {
            html: reader_html,
            theme_fingerprint: String::new(),
        })
    }

    /// Run the full pipeline and persist all intermediate artifacts to the
    /// content store. This enables the 5-tier cache hierarchy on subsequent
    /// loads.
    pub async fn build_html_with_store(
        &self,
        entry_id: i64,
        entry_url: &str,
        theme: &ThemeTokens,
        content_store: &dyn ContentStore,
    ) -> Result<ReaderHTML, AppError> {
        // 1. Fetch source HTML.
        let raw_html = crate::reader::readability::fetch_article_html(entry_url).await?;

        // 2. Persist source HTML.
        content_store
            .upsert_source(entry_id, &raw_html, Some(entry_url), "default")
            .await?;

        // 3. Extract main article content.
        let cleaned = crate::reader::readability::extract_article_content(&raw_html)?;

        // 4. Convert cleaned HTML to Markdown.
        let markdown =
            crate::reader::markdown_converter::html_to_markdown(&cleaned.content_html)?;

        // 5. Persist pipeline artifacts (cleaned HTML + Markdown).
        content_store
            .upsert_artifacts(
                entry_id,
                Some(&cleaned.content_html),
                cleaned.title.as_deref(),
                cleaned.byline.as_deref(),
                Some(PipelineVersions::READABILITY),
                Some(&markdown),
                Some(PipelineVersions::MARKDOWN),
                "cleaned",
            )
            .await?;

        // 6. Render Markdown to themed reader HTML.
        let reader_html =
            crate::reader::markdown_renderer::markdown_to_reader_html(&markdown, theme, None)?;

        Ok(ReaderHTML {
            html: reader_html,
            theme_fingerprint: String::new(),
        })
    }

    /// Re-build from a cached content record, skipping expensive steps where
    /// cached artifacts are still valid.
    pub async fn build_html_from_cache(
        &self,
        entry_id: i64,
        cached: &crate::db::models::Content,
        theme: &ThemeTokens,
        content_store: &dyn ContentStore,
    ) -> Result<ReaderHTML, AppError> {
        let action = self.rebuild_action(
            None,                         // cached_html_version
            false,                        // has_cached_html (checked separately)
            cached.markdown_version.map(|v| v as i64),
            cached.markdown.is_some(),
            cached.readability_version.map(|v| v as i64),
            cached.cleaned_html.is_some(),
            cached.html.is_some(),
        );

        match action {
            RebuildAction::RerenderFromMarkdown | RebuildAction::RebuildMarkdownAndRender => {
                // We have cleaned HTML, re-convert to Markdown if needed and render.
                let cleaned = cached
                    .cleaned_html
                    .as_deref()
                    .unwrap_or("");
                let markdown =
                    crate::reader::markdown_converter::html_to_markdown(cleaned)?;

                // Persist updated markdown (version may have changed).
                content_store
                    .upsert_artifacts(
                        entry_id,
                        None, // cleaned HTML unchanged
                        None,
                        None,
                        None, // readability version unchanged
                        Some(&markdown),
                        Some(PipelineVersions::MARKDOWN),
                        "cleaned",
                    )
                    .await?;

                let html =
                    crate::reader::markdown_renderer::markdown_to_reader_html(&markdown, theme, None)?;
                Ok(ReaderHTML {
                    html,
                    theme_fingerprint: String::new(),
                })
            }
            RebuildAction::RerunReadabilityAndRebuild => {
                // Have source HTML, re-run readability + convert + render.
                let source = cached.html.as_deref().unwrap_or("");
                let cleaned = crate::reader::readability::extract_article_content(source)?;
                let markdown =
                    crate::reader::markdown_converter::html_to_markdown(&cleaned.content_html)?;

                content_store
                    .upsert_artifacts(
                        entry_id,
                        Some(&cleaned.content_html),
                        cleaned.title.as_deref(),
                        cleaned.byline.as_deref(),
                        Some(PipelineVersions::READABILITY),
                        Some(&markdown),
                        Some(PipelineVersions::MARKDOWN),
                        "cleaned",
                    )
                    .await?;

                let html =
                    crate::reader::markdown_renderer::markdown_to_reader_html(&markdown, theme, None)?;
                Ok(ReaderHTML {
                    html,
                    theme_fingerprint: String::new(),
                })
            }
            _ => {
                // ServeCached or FetchAndRebuildFull — fall back to full build.
                self.build_html_with_store(entry_id, "", theme, content_store).await
            }
        }
    }
}

impl ReaderPipeline for DefaultReaderPipeline {
    fn rebuild_action(
        &self,
        _cached_html_version: Option<i64>,
        has_cached_html: bool,
        markdown_version: Option<i64>,
        has_markdown: bool,
        readability_version: Option<i64>,
        has_cleaned_html: bool,
        has_source_html: bool,
    ) -> RebuildAction {
        // Tier 1: Rendered HTML is cached for this theme — nothing to do.
        if has_cached_html {
            return RebuildAction::ServeCached;
        }

        // Tier 2: Markdown is cached and version is current — just re-render.
        if has_markdown && markdown_version == Some(PipelineVersions::MARKDOWN as i64) {
            return RebuildAction::RerenderFromMarkdown;
        }

        // Tier 3: Cleaned HTML is cached and version is current — re-convert.
        if has_cleaned_html
            && readability_version == Some(PipelineVersions::READABILITY as i64)
        {
            return RebuildAction::RebuildMarkdownAndRender;
        }

        // Tier 4: Source HTML is cached — re-run readability.
        if has_source_html {
            return RebuildAction::RerunReadabilityAndRebuild;
        }

        // Tier 5: Nothing useful cached — full fetch and rebuild.
        RebuildAction::FetchAndRebuildFull
    }

    fn build_markdown_from_source(
        &self,
        html: &str,
        _base_url: &str,
    ) -> Result<String, AppError> {
        // Run the full pipeline from source HTML: extract content, then convert.
        let cleaned = crate::reader::readability::extract_article_content(html)?;
        crate::reader::markdown_converter::html_to_markdown(&cleaned.content_html)
    }

    fn render_html(&self, markdown: &str, _theme_css: &str) -> Result<String, AppError> {
        // Use default theme tokens when only a CSS string is provided.
        let theme = ThemeTokens::default();
        crate::reader::markdown_renderer::markdown_to_reader_html(markdown, &theme, None)
    }
}

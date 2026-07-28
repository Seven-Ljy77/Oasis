use tauri::State;

use crate::error::AppError;
use crate::reader::pipeline::{DefaultReaderPipeline, PipelineVersions, ReaderHTML};
use crate::reader::theme::ThemeTokens;
use crate::state::AppState;

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// Build a reader-mode HTML document for the given article.
///
/// When `entry_id` is provided the pipeline will attempt to use cached
/// artifacts (source HTML, cleaned HTML, Markdown) to skip expensive
/// network and processing steps. Theme tokens are derived from the
/// optional theme params; defaults are used otherwise.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct ReaderThemeParams {
    #[serde(rename = "fontFamily")]
    pub font_family: Option<String>,
    #[serde(rename = "fontSize")]
    pub font_size: Option<u32>,
    #[serde(rename = "lineHeight")]
    pub line_height: Option<f64>,
    #[serde(rename = "contentWidth")]
    pub content_width: Option<u32>,
    #[serde(rename = "quickStyle")]
    pub quick_style: Option<String>,
    #[serde(rename = "themeMode")]
    pub theme_mode: Option<String>,
}

/// Resolve a potentially relative entry URL to an absolute URL using the
/// entry's feed `feed_url` or `site_url` as the base.
fn resolve_entry_url(state: &AppState, entry_id: Option<i64>, entry_url: &str) -> String {
    // Already absolute — nothing to do.
    if entry_url.contains("://") {
        return entry_url.to_string();
    }
    // Try to resolve using the feed's URL from the database.
    if let Some(id) = entry_id {
        let db = state.db.clone();
        let url = entry_url.to_string();
        if let Ok(Some((maybe_site, feed))) = db.read(move |conn| {
            use rusqlite::OptionalExtension;
            conn.query_row(
                "SELECT f.site_url, f.feed_url FROM entry e \
                 JOIN feed f ON f.id = e.feed_id WHERE e.id = ?1",
                rusqlite::params![id],
                |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, String>(1)?)),
            )
            .optional()
            .map_err(|e| AppError::Database(e.to_string()))
        }) {
            // Try site_url first (must be absolute). Fall back to feed_url.
            let base_url = maybe_site
                .filter(|s| s.contains("://"))
                .unwrap_or(feed);
            if let Ok(abs) = url::Url::parse(&base_url) {
                if let Ok(resolved) = abs.join(&url) {
                    return resolved.to_string();
                }
            }
        }
    }
    entry_url.to_string()
}

#[tauri::command]
pub async fn build_reader_html(
    state: State<'_, AppState>,
    entry_url: String,
    theme: Option<ReaderThemeParams>,
    entry_id: Option<i64>,
) -> Result<ReaderHTML, AppError> {
    // Resolve relative entry URLs (e.g., `/posts/foo`) against the feed base.
    let entry_url = resolve_entry_url(&state, entry_id, &entry_url);

    // Look up the entry title for the reader heading.
    let title: Option<String> = if let Some(id) = entry_id {
        let db = state.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                use rusqlite::OptionalExtension;
                conn.query_row(
                    "SELECT title FROM entry WHERE id = ?1",
                    rusqlite::params![id],
                    |row| row.get::<_, Option<String>>(0),
                )
                .optional()
                .map_err(|e| AppError::Database(e.to_string()))
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok()
        .flatten()
        .flatten()
    } else {
        None
    };

    // Start from the appropriate base theme by appearance mode.
    let mut tokens = if let Some(ref t) = theme {
        match t.theme_mode.as_deref() {
            Some("forceDark") => ThemeTokens::dark(),
            Some("forceEyecare") | Some("eyecare") => ThemeTokens::eyecare(),
            _ => ThemeTokens::default(),
        }
    } else {
        ThemeTokens::default()
    };

    if let Some(t) = &theme {
        if let Some(ref ff) = t.font_family { tokens.font_family = ff.clone(); }
        if let Some(fs) = t.font_size { tokens.font_size = fs; }
        if let Some(lh) = t.line_height { tokens.line_height = lh; }
        if let Some(cw) = t.content_width { tokens.max_width = cw; }
        if let Some(ref qs) = t.quick_style {
            match qs.as_str() {
                "warm" => {
                    tokens.background_color = "#fdf6e3".into();
                    tokens.primary_text_color = "#5c4b2c".into();
                    tokens.secondary_text_color = "#8b7355".into();
                }
                "cool" => {
                    tokens.background_color = "#f0f4f8".into();
                    tokens.primary_text_color = "#2c3e50".into();
                    tokens.secondary_text_color = "#5a7d9a".into();
                }
                "slate" => {
                    tokens.background_color = "#f5f5f5".into();
                    tokens.primary_text_color = "#374151".into();
                    tokens.secondary_text_color = "#6b7280".into();
                }
                _ => {} // "none" — use defaults
            }
        }
    }

    let pipeline = DefaultReaderPipeline;

    // If entry_id is provided, try the full 5-tier cache hierarchy first.
    if let Some(id) = entry_id {
        match try_build_from_cache(&state, &pipeline, id, &entry_url, &tokens).await {
            Ok(mut html) => {
                if let Some(ref t) = title {
                    html.html = html.html.replace("<body>", &format!("<body>\n<h1>{}</h1>", html_escape(t)));
                }
                return Ok(html);
            }
            Err(e) => {
                if let Some(ref l) = state.logger {
                    let _ = l.warn("reader_cache_miss", &format!("Cache miss for entry {}: {}", id, e));
                }
            }
        }
    }

    // Fall through: full pipeline with DB persistence if entry_id is available.
    let mut result = if let Some(id) = entry_id {
        let cs: &dyn crate::db::content_store::ContentStore = state.content_store.as_ref();
        pipeline
            .build_html_with_store(id, &entry_url, &tokens, cs)
            .await
    } else {
        pipeline.build_html(&entry_url, &tokens).await
    };
    if let Err(ref e) = result {
        if let Some(ref l) = state.logger {
            let _ = l.error("reader_build_failed", &format!("Build HTML for {} failed: {}", entry_url, e));
        }
    }
    // Inject the entry title as <h1> at the top of the reader body so it
    // is numbered as segment 0, aligning with the Rust segment extractor.
    if let Ok(ref mut reader_html) = result {
        if let Some(ref t) = title {
            let title_tag = format!("<h1>{}</h1>", html_escape(t));
            reader_html.html = reader_html.html.replace("<body>", &format!("<body>\n{}", title_tag));
        }
    }
    result
}

/// Try to serve the reader HTML from the content store cache hierarchy.
///
/// The 5-tier cache check:
/// 1. Markdown cached with current version → re-render from Markdown (fast)
/// 2. Cleaned HTML cached with current version → re-convert + render
/// 3. Source HTML cached → re-run readability + convert + render
/// 4. Nothing cached → return error, caller will do full build
async fn try_build_from_cache(
    state: &AppState,
    pipeline: &DefaultReaderPipeline,
    entry_id: i64,
    _entry_url: &str,
    theme: &ThemeTokens,
) -> Result<ReaderHTML, AppError> {
    let cs: &dyn crate::db::content_store::ContentStore = state.content_store.as_ref();
    let cached = cs
        .load(entry_id)
        .await?
        .ok_or_else(|| AppError::NotFound("No cached content for entry".to_string()))?;

    // Tier 1: Markdown is cached and version is current → just re-render.
    if cached.markdown.is_some()
        && cached.markdown_version == Some(PipelineVersions::MARKDOWN as i32)
    {
        let markdown = cached.markdown.as_deref().unwrap_or("");
        let html =
            crate::reader::markdown_renderer::markdown_to_reader_html(markdown, theme, Some(_entry_url))?;
        return Ok(ReaderHTML {
            html,
            theme_fingerprint: String::new(),
        });
    }

    // Tier 2: Cleaned HTML cached with current version → re-convert + render.
    if cached.cleaned_html.is_some()
        && cached.readability_version == Some(PipelineVersions::READABILITY)
    {
        return pipeline
            .build_html_from_cache(entry_id, &cached, theme, cs)
            .await;
    }

    // Tier 3: Source HTML cached → re-run readability + convert + render.
    if cached.html.is_some() {
        return pipeline
            .build_html_from_cache(entry_id, &cached, theme, cs)
            .await;
    }

    // Tier 4: No useful cache — signal caller to do full build.
    Err(AppError::NotFound(
        "No usable cached content for entry".to_string(),
    ))
}

#[tauri::command]
pub async fn get_available_fonts(
    _state: State<'_, AppState>,
) -> Result<Vec<String>, AppError> {
    // Return a curated list of common system fonts that work well for reading.
    Ok(vec![
        "Georgia".into(),
        "Merriweather".into(),
        "Charter".into(),
        "Palatino".into(),
        "Times New Roman".into(),
        "Segoe UI".into(),
        "Arial".into(),
        "Helvetica".into(),
        "Verdana".into(),
        "Roboto".into(),
        "system-ui".into(),
    ])
}

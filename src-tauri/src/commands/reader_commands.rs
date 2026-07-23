use tauri::State;

use crate::error::AppError;
use crate::reader::pipeline::{DefaultReaderPipeline, ReaderHTML};
use crate::reader::theme::ThemeTokens;
use crate::state::AppState;

/// Build a reader-mode HTML document for the given article URL.
///
/// The frontend passes the entry's URL directly (the entry URL is available
/// from the entry list data already loaded in the UI). Theme tokens are
/// derived from defaults for now; theme customisation will be wired up in
/// a later phase.
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
}

#[tauri::command]
pub async fn build_reader_html(
    state: State<'_, AppState>,
    entry_url: String,
    theme: Option<ReaderThemeParams>,
) -> Result<ReaderHTML, AppError> {
    let mut tokens = ThemeTokens::default();
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
    // Try cached content first for faster theme-only rebuilds
    match try_render_from_cache(&state, &entry_url, &tokens).await {
        Ok(html) => Ok(html),
        Err(_) => pipeline.build_html(&entry_url, &tokens).await,
    }
}

/// Try to re-render from cached markdown in the content table.
async fn try_render_from_cache(
    state: &AppState,
    entry_url: &str,
    theme: &ThemeTokens,
) -> Result<ReaderHTML, AppError> {
    use rusqlite::OptionalExtension;
    let url = entry_url.to_string();
    let db = state.db.clone();
    let markdown = tokio::task::spawn_blocking(move || {
        let conn = db.conn();
        conn.query_row(
            "SELECT c.markdown FROM content c JOIN entry e ON c.entry_id = e.id WHERE e.url = ?1 AND c.markdown IS NOT NULL",
            rusqlite::params![url],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| AppError::Database(e.to_string()))
    }).await.map_err(|e| AppError::Database(e.to_string()))??
    .ok_or_else(|| AppError::NotFound("No cached markdown".to_string()))?;

    let html = crate::reader::markdown_renderer::markdown_to_reader_html(&markdown, theme)?;
    Ok(ReaderHTML { html, theme_fingerprint: String::new() })
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

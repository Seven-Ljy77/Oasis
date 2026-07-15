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
#[tauri::command]
pub async fn build_reader_html(
    _state: State<'_, AppState>,
    entry_url: String,
) -> Result<ReaderHTML, AppError> {
    let theme = ThemeTokens::default();
    let pipeline = DefaultReaderPipeline;
    pipeline.build_html(&entry_url, &theme).await
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

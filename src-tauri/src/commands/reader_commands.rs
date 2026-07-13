use tauri::State;

use crate::error::AppError;
use crate::reader::pipeline::ReaderHTML;
use crate::reader::theme::ThemeTokens;
use crate::state::AppState;

#[tauri::command]
pub async fn build_reader_html(
    _state: State<'_, AppState>,
    _entry_id: i64,
    _theme: ThemeTokens,
) -> Result<ReaderHTML, AppError> {
    todo!()
}

#[tauri::command]
pub async fn get_available_fonts(
    _state: State<'_, AppState>,
) -> Result<Vec<String>, AppError> {
    todo!()
}

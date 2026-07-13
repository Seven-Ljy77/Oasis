use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn save_note(
    _state: State<'_, AppState>,
    _entry_id: i64,
    _markdown_text: String,
) -> Result<(), AppError> {
    todo!()
}

#[tauri::command]
pub async fn load_note(
    _state: State<'_, AppState>,
    _entry_id: i64,
) -> Result<Option<String>, AppError> {
    todo!()
}

#[tauri::command]
pub async fn share_digest(
    _state: State<'_, AppState>,
    _entry_id: i64,
) -> Result<String, AppError> {
    todo!()
}

#[tauri::command]
pub async fn export_digest(
    _state: State<'_, AppState>,
    _entry_id: i64,
    _path: String,
    _template_id: Option<String>,
) -> Result<(), AppError> {
    todo!()
}

#[tauri::command]
pub async fn export_multiple_digest(
    _state: State<'_, AppState>,
    _entry_ids: Vec<i64>,
    _path: String,
    _template_id: Option<String>,
) -> Result<(), AppError> {
    todo!()
}

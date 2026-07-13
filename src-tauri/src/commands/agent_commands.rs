use tauri::State;

use crate::agent::tagging::executor::TagSuggestion;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn start_summary(
    _state: State<'_, AppState>,
    _entry_id: i64,
    _language: String,
    _detail: String,
) -> Result<(), AppError> {
    todo!()
}

#[tauri::command]
pub async fn start_translation(
    _state: State<'_, AppState>,
    _entry_id: i64,
    _language: String,
) -> Result<(), AppError> {
    todo!()
}

#[tauri::command]
pub async fn start_tagging_panel(
    _state: State<'_, AppState>,
    _entry_id: i64,
) -> Result<Vec<TagSuggestion>, AppError> {
    todo!()
}

#[tauri::command]
pub async fn cancel_agent(
    _state: State<'_, AppState>,
    _entry_id: i64,
    _task_kind: String,
) -> Result<(), AppError> {
    todo!()
}

#[tauri::command]
pub async fn start_batch_tagging(
    _state: State<'_, AppState>,
    _scope_label: Option<String>,
    _concurrency: u32,
    _skip_already_applied: bool,
    _skip_already_tagged: bool,
) -> Result<i64, AppError> {
    todo!()
}

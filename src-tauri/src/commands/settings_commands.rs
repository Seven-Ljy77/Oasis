use tauri::State;

use crate::error::AppError;
use crate::state::{AppConfig, AppState};

#[tauri::command]
pub async fn load_settings(
    _state: State<'_, AppState>,
) -> Result<AppConfig, AppError> {
    todo!()
}

#[tauri::command]
pub async fn save_settings(
    _state: State<'_, AppState>,
    _config: AppConfig,
) -> Result<(), AppError> {
    todo!()
}

#[tauri::command]
pub async fn test_provider_connection(
    _state: State<'_, AppState>,
    _provider_name: String,
    _model_name: String,
    _api_key: String,
    _base_url: String,
) -> Result<bool, AppError> {
    todo!()
}

#[tauri::command]
pub async fn reveal_custom_template(
    _state: State<'_, AppState>,
    _template_id: String,
) -> Result<(), AppError> {
    todo!()
}

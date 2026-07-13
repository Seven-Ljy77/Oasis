use crate::error::AppError;

#[tauri::command]
pub async fn open_file_dialog(
    _filters: Vec<String>,
) -> Result<Option<String>, AppError> {
    todo!()
}

#[tauri::command]
pub async fn save_file_dialog(
    _default_name: String,
    _filters: Vec<String>,
) -> Result<Option<String>, AppError> {
    todo!()
}

#[tauri::command]
pub async fn pick_export_folder(
) -> Result<Option<String>, AppError> {
    todo!()
}

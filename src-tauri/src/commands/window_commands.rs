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

#[tauri::command]
pub async fn open_in_browser(url: String) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &url])
            .spawn()
            .map_err(|e| AppError::Shell(e.to_string()))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| AppError::Shell(e.to_string()))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| AppError::Shell(e.to_string()))?;
    }
    Ok(())
}

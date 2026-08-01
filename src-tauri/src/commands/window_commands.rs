use crate::error::AppError;
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, FilePath};

fn selected_path(path: Option<FilePath>) -> Result<Option<String>, AppError> {
    path.map(|path| {
        path.into_path()
            .map(|path| path.to_string_lossy().into_owned())
            .map_err(|error| AppError::Shell(format!("Invalid selected path: {error}")))
    })
    .transpose()
}

fn add_filters<R: tauri::Runtime>(
    mut dialog: tauri_plugin_dialog::FileDialogBuilder<R>,
    filters: &[String],
) -> tauri_plugin_dialog::FileDialogBuilder<R> {
    if !filters.is_empty() {
        let extensions: Vec<&str> = filters
            .iter()
            .map(|filter| filter.trim().trim_start_matches("*."))
            .filter(|filter| !filter.is_empty())
            .collect();
        if !extensions.is_empty() {
            dialog = dialog.add_filter("Files", &extensions);
        }
    }
    dialog
}

#[tauri::command]
pub async fn open_file_dialog(
    app: AppHandle,
    filters: Vec<String>,
) -> Result<Option<String>, AppError> {
    selected_path(add_filters(app.dialog().file(), &filters).blocking_pick_file())
}

#[tauri::command]
pub async fn save_file_dialog(
    app: AppHandle,
    default_name: String,
    filters: Vec<String>,
) -> Result<Option<String>, AppError> {
    let dialog = add_filters(app.dialog().file(), &filters);
    selected_path(dialog.set_file_name(default_name).blocking_save_file())
}

#[tauri::command]
pub async fn pick_export_folder(app: AppHandle) -> Result<Option<String>, AppError> {
    selected_path(app.dialog().file().blocking_pick_folder())
}

#[tauri::command]
pub async fn open_in_browser(url: String) -> Result<(), AppError> {
    let parsed = url::Url::parse(&url)
        .map_err(|error| AppError::InvalidInput(format!("Invalid URL: {error}")))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(AppError::InvalidInput(
            "Only HTTP and HTTPS URLs can be opened".to_string(),
        ));
    }
    open::that(parsed.as_str()).map_err(|error| AppError::Shell(error.to_string()))?;
    Ok(())
}

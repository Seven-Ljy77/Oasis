use tauri::State;

use crate::db::models::Feed;
use crate::error::AppError;
use crate::feed::opml_import::ImportResult;
use crate::feed::sync_service::SyncProgress;
use crate::state::AppState;

#[tauri::command]
pub async fn add_feed(
    _state: State<'_, AppState>,
    _url: String,
    _title: Option<String>,
) -> Result<Feed, AppError> {
    todo!()
}

#[tauri::command]
pub async fn update_feed(
    _state: State<'_, AppState>,
    _id: i64,
    _url: String,
    _title: Option<String>,
) -> Result<Feed, AppError> {
    todo!()
}

#[tauri::command]
pub async fn delete_feed(
    _state: State<'_, AppState>,
    _id: i64,
) -> Result<(), AppError> {
    todo!()
}

#[tauri::command]
pub async fn sync_feeds(
    _state: State<'_, AppState>,
    _concurrency: u32,
) -> Result<SyncProgress, AppError> {
    todo!()
}

#[tauri::command]
pub async fn import_opml(
    _state: State<'_, AppState>,
    _path: String,
    _replace: bool,
    _force_site_name: bool,
) -> Result<ImportResult, AppError> {
    todo!()
}

#[tauri::command]
pub async fn export_opml(
    _state: State<'_, AppState>,
    _path: String,
) -> Result<(), AppError> {
    todo!()
}

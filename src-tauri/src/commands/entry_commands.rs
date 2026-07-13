use tauri::State;

use crate::db::models::Entry;
use crate::error::AppError;
use crate::state::AppState;

use serde::{Deserialize, Serialize};

/// Query parameters for loading the entry list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryListQuery {
    pub feed_id: Option<i64>,
    pub tag_ids: Option<Vec<i64>>,
    pub tag_match_mode: Option<String>,
    pub show_unread_only: bool,
    pub search_text: Option<String>,
    pub page_size: u32,
}

/// A page of entry results.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryPage {
    pub entries: Vec<Entry>,
    pub total_count: u64,
    pub cursor: Option<PageCursor>,
}

/// Cursor for pagination.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageCursor {
    pub offset: u64,
    pub page_size: u32,
}

#[tauri::command]
pub async fn load_entries(
    _state: State<'_, AppState>,
    _query: EntryListQuery,
) -> Result<EntryPage, AppError> {
    todo!()
}

#[tauri::command]
pub async fn load_next_entries(
    _state: State<'_, AppState>,
    _cursor: PageCursor,
) -> Result<EntryPage, AppError> {
    todo!()
}

#[tauri::command]
pub async fn mark_read(
    _state: State<'_, AppState>,
    _entry_ids: Vec<i64>,
    _is_read: bool,
) -> Result<(), AppError> {
    todo!()
}

#[tauri::command]
pub async fn mark_starred(
    _state: State<'_, AppState>,
    _entry_id: i64,
    _is_starred: bool,
) -> Result<(), AppError> {
    todo!()
}

#[tauri::command]
pub async fn delete_entry(
    _state: State<'_, AppState>,
    _entry_id: i64,
) -> Result<(), AppError> {
    todo!()
}

#[tauri::command]
pub async fn search_entries(
    _state: State<'_, AppState>,
    _text: String,
    _scope: String,
) -> Result<Vec<Entry>, AppError> {
    todo!()
}

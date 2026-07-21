use tauri::State;
use rusqlite::params;

use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn save_note(
    state: State<'_, AppState>,
    entry_id: i64,
    text: String,
) -> Result<(), AppError> {
    let markdown_text = text;
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.conn();
        if markdown_text.trim().is_empty() {
            // Delete empty notes
            conn.execute(
                "DELETE FROM entry_note WHERE entry_id = ?1",
                params![entry_id],
            )?;
        } else {
            conn.execute(
                "INSERT INTO entry_note (entry_id, markdown_text, created_at, updated_at) \
                 VALUES (?1, ?2, datetime('now'), datetime('now')) \
                 ON CONFLICT(entry_id) DO UPDATE SET \
                    markdown_text = excluded.markdown_text, \
                    updated_at = datetime('now')",
                params![entry_id, markdown_text],
            )?;
        }
        Ok::<_, AppError>(())
    })
    .await
    .map_err(|e| AppError::Database(e.to_string()))?
}

#[tauri::command]
pub async fn get_note(
    state: State<'_, AppState>,
    entry_id: i64,
) -> Result<Option<serde_json::Value>, AppError> {
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.conn();
        let result = conn.query_row(
            "SELECT markdown_text FROM entry_note WHERE entry_id = ?1",
            params![entry_id],
            |row| row.get::<_, String>(0),
        );
        match result {
            Ok(text) if !text.trim().is_empty() => Ok(Some(serde_json::json!({ "text": text }))),
            _ => Ok(None),
        }
    })
    .await
    .map_err(|e| AppError::Database(e.to_string()))?
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

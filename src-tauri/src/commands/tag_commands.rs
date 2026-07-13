use tauri::State;

use crate::db::models::Tag;
use crate::error::AppError;
use crate::state::AppState;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagWithAliases {
    pub tag: Tag,
    pub aliases: Vec<String>,
}

#[tauri::command]
pub async fn load_tags(
    _state: State<'_, AppState>,
) -> Result<Vec<TagWithAliases>, AppError> {
    todo!()
}

#[tauri::command]
pub async fn create_tag(
    _state: State<'_, AppState>,
    _name: String,
) -> Result<Tag, AppError> {
    todo!()
}

#[tauri::command]
pub async fn rename_tag(
    _state: State<'_, AppState>,
    _id: i64,
    _new_name: String,
) -> Result<Tag, AppError> {
    todo!()
}

#[tauri::command]
pub async fn delete_tag(
    _state: State<'_, AppState>,
    _id: i64,
) -> Result<(), AppError> {
    todo!()
}

#[tauri::command]
pub async fn merge_tags(
    _state: State<'_, AppState>,
    _source_id: i64,
    _target_id: i64,
) -> Result<(), AppError> {
    todo!()
}

#[tauri::command]
pub async fn add_alias(
    _state: State<'_, AppState>,
    _tag_id: i64,
    _alias: String,
) -> Result<(), AppError> {
    todo!()
}

#[tauri::command]
pub async fn delete_alias(
    _state: State<'_, AppState>,
    _alias_id: i64,
) -> Result<(), AppError> {
    todo!()
}

#[tauri::command]
pub async fn load_tag_library(
    _state: State<'_, AppState>,
) -> Result<Vec<TagWithAliases>, AppError> {
    todo!()
}

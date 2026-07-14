use tauri::State;

use crate::db::models::Tag;
use crate::db::tag_store::TagStore;
use crate::error::AppError;
use crate::state::AppState;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagWithAliases {
    pub tag: Tag,
    pub aliases: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagSuggestion {
    pub name: String,
    pub source: String, // "ai" | "nlp" | "existing"
    pub tag_id: Option<i64>,
}

// ---------------------------------------------------------------------------
// Tag CRUD
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_tags(
    state: State<'_, AppState>,
) -> Result<Vec<TagWithAliases>, AppError> {
    let tags = state.tag_store.load_all().await?;
    let all_aliases = state.tag_store.load_all_aliases().await?;

    // Group aliases by tag_id
    let result: Vec<TagWithAliases> = tags
        .into_iter()
        .map(|tag| {
            let aliases: Vec<String> = all_aliases
                .iter()
                .filter(|(tid, _)| *tid == tag.id)
                .map(|(_, alias)| alias.clone())
                .collect();
            TagWithAliases { tag, aliases }
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn create_tag(
    state: State<'_, AppState>,
    name: String,
    is_provisional: Option<bool>,
) -> Result<Tag, AppError> {
    let mut tag = state.tag_store.create(&name).await?;

    // If the caller explicitly wants a non-provisional tag, promote it
    if is_provisional == Some(false) {
        let db = state.db.clone();
        let tag_id = tag.id;
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "UPDATE tag SET is_provisional = 0 WHERE id = ?1",
                    rusqlite::params![tag_id],
                )?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))??;
        tag.is_provisional = false;
    }

    Ok(tag)
}

#[tauri::command]
pub async fn rename_tag(
    state: State<'_, AppState>,
    tag_id: i64,
    new_name: String,
) -> Result<Tag, AppError> {
    state.tag_store.rename(tag_id, &new_name).await
}

#[tauri::command]
pub async fn delete_tag(
    state: State<'_, AppState>,
    tag_id: i64,
) -> Result<(), AppError> {
    state.tag_store.delete(tag_id).await
}

#[tauri::command]
pub async fn merge_tag(
    state: State<'_, AppState>,
    source_tag_id: i64,
    target_tag_id: i64,
) -> Result<(), AppError> {
    state.tag_store.merge(source_tag_id, target_tag_id).await
}

// ---------------------------------------------------------------------------
// Entry-tag associations
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn assign_tag(
    state: State<'_, AppState>,
    entry_id: i64,
    tag_id: i64,
) -> Result<(), AppError> {
    state.tag_store.assign_to_entry(entry_id, tag_id, "manual").await
}

#[tauri::command]
pub async fn remove_tag(
    state: State<'_, AppState>,
    entry_id: i64,
    tag_id: i64,
) -> Result<(), AppError> {
    state.tag_store.remove_from_entry(entry_id, tag_id).await
}

#[tauri::command]
pub async fn get_tags_for_entry(
    state: State<'_, AppState>,
    entry_id: i64,
) -> Result<Vec<Tag>, AppError> {
    let entry_tags = state.tag_store.load_by_entry(entry_id).await?;
    let mut result = Vec::new();
    for et in entry_tags {
        match state.tag_store.load_by_id(et.tag_id).await {
            Ok(tag) => result.push(tag),
            Err(_) => continue, // skip orphaned references
        }
    }
    Ok(result)
}

// ---------------------------------------------------------------------------
// Aliases
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn add_alias(
    state: State<'_, AppState>,
    tag_id: i64,
    alias: String,
) -> Result<(), AppError> {
    state.tag_store.add_alias(tag_id, &alias).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_alias(
    state: State<'_, AppState>,
    alias_id: i64,
) -> Result<(), AppError> {
    state.tag_store.delete_alias(alias_id).await
}

// ---------------------------------------------------------------------------
// Tag library (full data for management UI)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_tag_library(
    state: State<'_, AppState>,
) -> Result<Vec<TagWithAliases>, AppError> {
    // Same as get_tags — provides tags with their aliases
    get_tags(state).await
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn suggest_tags(
    state: State<'_, AppState>,
    _entry_id: i64,
) -> Result<Vec<TagSuggestion>, AppError> {
    // For now, return existing tags as suggestions (AI/NLP suggestions
    // will be added when the agent tagging executors are implemented).
    let tags = state.tag_store.load_all().await?;
    let suggestions: Vec<TagSuggestion> = tags
        .into_iter()
        .map(|t| TagSuggestion {
            name: t.name,
            source: "existing".to_string(),
            tag_id: Some(t.id),
        })
        .collect();
    Ok(suggestions)
}

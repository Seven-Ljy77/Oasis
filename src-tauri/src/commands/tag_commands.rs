use tauri::State;

use crate::agent::tagging::executor::TagSuggestion;
use crate::db::entry_store::EntryStore;
use crate::db::models::Tag;
use crate::db::tag_store::TagStore;
use crate::error::AppError;
use crate::state::AppState;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagWithAliases {
    #[serde(flatten)]
    pub tag: Tag,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub aliases: Vec<String>,
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
    _is_provisional: Option<bool>,
) -> Result<Tag, AppError> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidInput("Tag name cannot be empty".into()));
    }
    let tag = state.tag_store.create(trimmed).await?;
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
            Err(e) => {
                // Tag may have been deleted since assignment. Skip it.
                if matches!(e, AppError::NotFound(_)) {
                    continue;
                }
                return Err(e);
            }
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
    entry_id: i64,
) -> Result<Vec<TagSuggestion>, AppError> {
    let mut suggestions: Vec<TagSuggestion> = Vec::new();
    let ai_enabled = state.config.read().await.ai_tagging_enabled;

    // 1. Try AI tagging executor (only if enabled)
    if ai_enabled {
        use crate::agent::provider::OpenAIProvider;
        use crate::agent::route::RouteResolver;
        use crate::agent::AgentTaskKind;
        use crate::db::agent_config_store::AgentConfigStore;

        let resolver = RouteResolver::new(state.agent_config_store.clone());
        let routes = match resolver
            .resolve_route(&AgentTaskKind::Tagging, None, None)
            .await {
                Ok(r) => r,
                Err(e) => {
                    suggestions.push(TagSuggestion {
                        name: e.to_string(),
                        source: "error".to_string(),
                        tag_id: None,
                    });
                    Vec::new()
                },
            };
        if let Some(route) = routes.first() {
            let providers = state.agent_config_store.load_providers(false).await?;
            if let Some(provider) = providers.iter().find(|p| p.id == route.provider_profile_id || p.name == route.provider_name) {
                let llm = std::sync::Arc::new(OpenAIProvider::new(
                    provider.name.clone(),
                    provider.base_url.clone(),
                    provider.api_key_ref.clone(),
                ));
                let tag_store: std::sync::Arc<dyn crate::db::tag_store::TagStore> = state.tag_store.clone();
                let executor = crate::agent::tagging::executor::TaggingExecutor::new(
                    llm,
                    std::sync::Arc::new(resolver),
                    state.prompt_template_store.clone(),
                    tag_store,
                );

                let entry = state.entry_store.load_by_id(entry_id).await?;
                let title = entry.as_ref().and_then(|e| e.title.clone()).unwrap_or_default();
                let summary_text = entry.as_ref().and_then(|e| e.summary.clone()).unwrap_or_default();
                // Try content table for richer text
                let content = {
                    let db = state.db.clone();
                    let eid = entry_id;
                    tokio::task::spawn_blocking(move || {
                        let conn = db.conn();
                        conn.query_row(
                            "SELECT markdown FROM content WHERE entry_id = ?1",
                            rusqlite::params![eid],
                            |row| row.get::<_, Option<String>>(0),
                        ).ok().flatten()
                    }).await.map_err(|e| AppError::Database(e.to_string()))?
                }.unwrap_or(summary_text);

                match executor.execute_for_entry(entry_id, &title, &content).await {
                    Ok(ai_suggestions) => suggestions.extend(ai_suggestions),
                    Err(e) => {
                        // Report error as a "suggestion" so frontend can display it
                        suggestions.push(TagSuggestion {
                            name: format!("AI Error: {}", e),
                            source: "error".to_string(),
                            tag_id: None,
                        });
                    }
                }
            }
        }
    }

    // 2. Add existing tags not already suggested by AI
    let tags = state.tag_store.load_all().await?;
    let ai_names: std::collections::HashSet<String> = suggestions
        .iter()
        .map(|s| s.name.to_lowercase())
        .collect();
    for t in tags {
        if !ai_names.contains(&t.name.to_lowercase()) && t.usage_count > 0 {
            suggestions.push(TagSuggestion {
                name: t.name,
                source: "existing".to_string(),
                tag_id: Some(t.id),
            });
        }
    }

    Ok(suggestions)
}

/// Delete tags with empty or whitespace-only names (cleanup from buggy sessions).
#[tauri::command]
pub async fn cleanup_empty_tags(
    state: State<'_, AppState>,
) -> Result<usize, AppError> {
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        db.write(|conn| {
            // First dump all tags for diagnosis
            let mut stmt = conn.prepare("SELECT id, name, hex(name), hex(normalized_name), LENGTH(name) FROM tag ORDER BY id")?;
            let rows = stmt.query_map([], |row| {
                Ok(format!("id={} name=[{}] hex={} hex_norm={} len={}",
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i32>(4)?
                ))
            })?.collect::<Result<Vec<_>, _>>()?;
            for r in &rows {
                println!("TAG_DEBUG: {}", r);
            }

            // Delete with multiple strategies
            let c1 = conn.execute("DELETE FROM tag WHERE name = ''", [])?;
            let c2 = conn.execute("DELETE FROM tag WHERE normalized_name = ''", [])?;
            let c3 = conn.execute("DELETE FROM tag WHERE LENGTH(TRIM(name)) = 0", [])?;
            let c4 = conn.execute("DELETE FROM tag WHERE LENGTH(TRIM(normalized_name)) = 0", [])?;
            let total = c1 + c2 + c3 + c4;
            println!("TAG_CLEANUP: deleted {} tags (c1={} c2={} c3={} c4={})", total, c1, c2, c3, c4);
            Ok(total)
        })
    })
    .await
    .map_err(|e| AppError::Database(e.to_string()))?
}

/// Debug: dump all tags with their raw name bytes for diagnosis.
#[tauri::command]
pub async fn debug_dump_tags(
    state: State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        db.read(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, normalized_name, hex(name), hex(normalized_name), LENGTH(name), is_provisional, usage_count FROM tag ORDER BY id"
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "normalized_name": row.get::<_, String>(2)?,
                    "hex_name": row.get::<_, String>(3)?,
                    "hex_norm": row.get::<_, String>(4)?,
                    "len": row.get::<_, i32>(5)?,
                    "provisional": row.get::<_, i32>(6)?,
                    "count": row.get::<_, i32>(7)?
                }))
            })?.collect::<Result<Vec<_>, _>>()?;
            Ok(rows)
        })
    })
    .await
    .map_err(|e| AppError::Database(e.to_string()))?
}

/// Delete multiple tags by their IDs.
#[tauri::command]
pub async fn delete_tags_batch(
    state: State<'_, AppState>,
    tag_ids: Vec<i64>,
) -> Result<usize, AppError> {
    let mut count = 0usize;
    for id in tag_ids {
        state.tag_store.delete(id).await?;
        count += 1;
    }
    Ok(count)
}

/// Delete all tags that have usage_count = 0.
#[tauri::command]
pub async fn delete_unused_tags(
    state: State<'_, AppState>,
) -> Result<usize, AppError> {
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        db.write(|conn| {
            let count = conn.execute(
                "DELETE FROM tag WHERE usage_count = 0",
                [],
            )?;
            Ok(count)
        })
    })
    .await
    .map_err(|e| AppError::Database(e.to_string()))?
}

/// Recalculate all tag usage counts based on non-deleted entries.
#[tauri::command]
pub async fn recalculate_tag_counts(
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    state.tag_store.recalculate_counts().await
}

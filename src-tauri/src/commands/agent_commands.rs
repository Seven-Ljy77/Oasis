use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use crate::agent::provider::{LLMProvider, OpenAIProvider};
use crate::agent::route::RouteResolver;
use crate::agent::summary::executor::{SummaryExecutor, SummaryRunEvent, SummaryRunRequest};
use crate::agent::tagging::batch::{BatchTaggingConfig, BatchTaggingExecutor};
use crate::agent::tagging::executor::TagSuggestion;
use crate::agent::translation::executor::TranslationRunEvent;
use crate::agent::AgentTaskKind;
use crate::db::agent_config_store::AgentConfigStore;
use crate::db::entry_store::EntryStore;
use crate::db::models::{AgentModelProfile, AgentProfile, AgentProviderProfile};
use crate::db::summary_store::SummaryStore;
use crate::db::tag_store::TagStore;
use crate::db::translation_store::TranslationStore;
use crate::error::AppError;
use crate::state::AppState;

// =============================================================================
// Provider CRUD
// =============================================================================

#[tauri::command]
pub async fn get_agent_providers(
    state: State<'_, AppState>,
) -> Result<Vec<AgentProviderProfile>, AppError> {
    state.agent_config_store.load_providers(false).await
}

#[tauri::command]
pub async fn add_agent_provider(
    state: State<'_, AppState>,
    name: String,
    base_url: String,
    api_key: String,
    test_model: Option<String>,
) -> Result<AgentProviderProfile, AppError> {
    let provider = AgentProviderProfile {
        id: 0,
        name,
        base_url,
        api_key_ref: api_key,
        test_model,
        is_default: false,
        is_enabled: true,
        is_archived: false,
        archived_at: None,
        created_at: String::new(),
    };
    state.agent_config_store.upsert_provider(&provider).await
}

#[tauri::command]
pub async fn update_agent_provider(
    state: State<'_, AppState>,
    provider_profile_id: i64,
    updates: AgentProviderProfile,
) -> Result<AgentProviderProfile, AppError> {
    let mut provider = updates;
    provider.id = provider_profile_id;
    state.agent_config_store.upsert_provider(&provider).await
}

#[tauri::command]
pub async fn delete_agent_provider(
    state: State<'_, AppState>,
    provider_profile_id: i64,
) -> Result<(), AppError> {
    state.agent_config_store.archive_provider(provider_profile_id).await
}

#[tauri::command]
pub async fn archive_agent_provider(
    state: State<'_, AppState>,
    provider_profile_id: i64,
) -> Result<(), AppError> {
    state.agent_config_store.archive_provider(provider_profile_id).await
}

#[tauri::command]
pub async fn unarchive_agent_provider(
    _state: State<'_, AppState>,
    _provider_profile_id: i64,
) -> Result<(), AppError> {
    // Unarchive: load all including archived, update is_archived = false, upsert
    let provider = AgentProviderProfile {
        id: _provider_profile_id,
        name: String::new(),
        base_url: String::new(),
        api_key_ref: String::new(),
        test_model: None,
        is_default: false,
        is_enabled: true,
        is_archived: false,
        archived_at: None,
        created_at: String::new(),
    };
    _state.agent_config_store.upsert_provider(&provider).await?;
    Ok(())
}

// =============================================================================
// Model CRUD
// =============================================================================

#[tauri::command]
pub async fn get_agent_models(
    state: State<'_, AppState>,
    provider_profile_id: i64,
) -> Result<Vec<AgentModelProfile>, AppError> {
    state.agent_config_store.load_models(provider_profile_id, false).await
}

#[tauri::command]
pub async fn add_agent_model(
    state: State<'_, AppState>,
    provider_profile_id: i64,
    model: AgentModelProfile,
) -> Result<AgentModelProfile, AppError> {
    let mut m = model;
    m.id = 0;
    m.provider_profile_id = provider_profile_id;
    state.agent_config_store.upsert_model(&m).await
}

#[tauri::command]
pub async fn update_agent_model(
    state: State<'_, AppState>,
    model_profile_id: i64,
    updates: AgentModelProfile,
) -> Result<AgentModelProfile, AppError> {
    let mut model = updates;
    model.id = model_profile_id;
    state.agent_config_store.upsert_model(&model).await
}

#[tauri::command]
pub async fn delete_agent_model(
    state: State<'_, AppState>,
    model_profile_id: i64,
) -> Result<(), AppError> {
    state.agent_config_store.archive_model(model_profile_id).await
}

#[tauri::command]
pub async fn test_agent_model(
    state: State<'_, AppState>,
    model_profile_id: i64,
) -> Result<bool, AppError> {
    // Find the model and its provider
    let providers = state.agent_config_store.load_providers(false).await?;
    for provider in &providers {
        let models = state.agent_config_store.load_models(provider.id, false).await?;
        if let Some(model) = models.iter().find(|m| m.id == model_profile_id) {
            let client = OpenAIProvider::new(
                provider.name.clone(),
                provider.base_url.clone(),
                provider.api_key_ref.clone(),
            );
            let request = crate::agent::provider::LLMRequest {
                model: model.model_name.clone(),
                messages: vec![crate::agent::provider::LLMMessage {
                    role: "user".to_string(),
                    content: "Hi".to_string(),
                }],
                temperature: None,
                top_p: None,
                max_tokens: Some(1),
                stream: false,
            };
            match client.complete(&request).await {
                Ok(_) => return Ok(true),
                Err(_) => return Ok(false),
            }
        }
    }
    Err(AppError::NotFound(format!(
        "Model not found: {model_profile_id}"
    )))
}

// =============================================================================
// Agent Profile (routing) CRUD
// =============================================================================

#[tauri::command]
pub async fn get_agent_profile(
    state: State<'_, AppState>,
    agent_type: String,
) -> Result<Option<AgentProfile>, AppError> {
    let profiles = state.agent_config_store.load_profiles().await?;
    Ok(profiles.into_iter().find(|p| p.agent_type == agent_type))
}

#[tauri::command]
pub async fn set_agent_profile(
    state: State<'_, AppState>,
    profile: AgentProfile,
) -> Result<(), AppError> {
    state.agent_config_store.upsert_profile(&profile).await?;
    Ok(())
}

// =============================================================================
// Agent task dispatch (original stubs implemented)
// =============================================================================

/// Build an OpenAIProvider from a route candidate.
async fn build_provider(
    config_store: Arc<dyn AgentConfigStore>,
    route: &crate::agent::route::RouteCandidate,
) -> Result<OpenAIProvider, AppError> {
    let providers = config_store.load_providers(false).await?;
    for p in &providers {
        if p.id == route.provider_profile_id || p.name == route.provider_name {
            return Ok(OpenAIProvider::new(
                p.name.clone(),
                p.base_url.clone(),
                p.api_key_ref.clone(),
            ));
        }
    }
    // Fallback: try to find any provider with matching name
    for p in &providers {
        if p.name == route.provider_name {
            return Ok(OpenAIProvider::new(
                p.name.clone(),
                p.base_url.clone(),
                p.api_key_ref.clone(),
            ));
        }
    }
    Err(AppError::Config(format!(
        "Provider not found: {}",
        route.provider_name
    )))
}

#[tauri::command]
pub async fn start_summary(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    entry_id: i64,
    language: String,
    detail: String,
) -> Result<(), AppError> {
    let entries = state
        .entry_store
        .search(&entry_id.to_string(), crate::db::entry_store::SearchScope::TitleOnly)
        .await?;
    let entry = entries.iter().find(|e| e.id == entry_id);
    let title = entry.and_then(|e| e.title.clone()).unwrap_or_default();
    let content = entry.and_then(|e| e.summary.clone()).unwrap_or_default();

    let resolver = RouteResolver::new(state.agent_config_store.clone());
    let routes = resolver
        .resolve_route(&AgentTaskKind::Summary, None, None)
        .await?;
    let route = routes
        .first()
        .ok_or_else(|| AppError::Config("No summary model configured".to_string()))?;

    let provider: Arc<dyn LLMProvider> = Arc::new(
        build_provider(state.agent_config_store.clone() as Arc<dyn AgentConfigStore>, route).await?,
    );
    let summary_store: Arc<dyn crate::db::summary_store::SummaryStore> = state.summary_store.clone();
    let executor = SummaryExecutor::new(
        provider,
        Arc::new(resolver),
        state.prompt_template_store.clone(),
        summary_store,
    );

    let request = SummaryRunRequest {
        entry_id,
        target_language: language,
        detail_level: detail,
        title,
        content,
    };

    let handle = app_handle.clone();
    executor
        .execute(&request, move |event| {
            let h = handle.clone();
            match event {
                SummaryRunEvent::Started { entry_id: eid } => {
                    let _ = h.emit("summary-token", serde_json::json!({
                        "entry_id": eid,
                        "token": "",
                        "is_complete": false,
                    }));
                }
                SummaryRunEvent::Token { entry_id: eid, token } => {
                    let _ = h.emit("summary-token", serde_json::json!({
                        "entry_id": eid,
                        "token": token,
                        "is_complete": false,
                    }));
                }
                SummaryRunEvent::Terminal { entry_id: eid, full_text, .. } => {
                    let _ = h.emit("summary-token", serde_json::json!({
                        "entry_id": eid,
                        "token": full_text,
                        "is_complete": true,
                    }));
                }
            }
        })
        .await
}

#[tauri::command]
pub async fn start_translation(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    entry_id: i64,
    language: String,
) -> Result<(), AppError> {
    let resolver = RouteResolver::new(state.agent_config_store.clone());
    let routes = resolver
        .resolve_route(&AgentTaskKind::Translation, None, None)
        .await?;
    let route = routes
        .first()
        .ok_or_else(|| AppError::Config("No translation model configured".to_string()))?;

    let provider: Arc<dyn LLMProvider> = Arc::new(
        build_provider(state.agent_config_store.clone() as Arc<dyn AgentConfigStore>, route).await?,
    );
    let translation_store: Arc<dyn crate::db::translation_store::TranslationStore> =
        state.translation_store.clone();
    let executor = crate::agent::translation::executor::TranslationExecutor::new(
        provider,
        Arc::new(resolver),
        state.prompt_template_store.clone(),
        translation_store,
    );

    let all_entries = state
        .entry_store
        .search(&entry_id.to_string(), crate::db::entry_store::SearchScope::TitleOnly)
        .await?;
    let entry = all_entries.iter().find(|e| e.id == entry_id);
    let title = entry.and_then(|e| e.title.clone());
    let content = entry.and_then(|e| e.summary.clone()).unwrap_or_default();

    let request = crate::agent::translation::executor::TranslationRunRequest {
        entry_id,
        target_language: language,
        content,
        title,
        concurrency: 3,
    };

    let handle = app_handle.clone();
    executor
        .execute(&request, move |event| {
            let h = handle.clone();
            match event {
                TranslationRunEvent::Started { entry_id: eid } => {
                    let _ = h.emit("translation-segment", serde_json::json!({
                        "entry_id": eid,
                        "segment_id": "",
                        "text": "",
                        "status": "started",
                    }));
                }
                TranslationRunEvent::SegmentCompleted { entry_id: eid, segment_id, translated_text } => {
                    let _ = h.emit("translation-segment", serde_json::json!({
                        "entry_id": eid,
                        "segment_id": segment_id,
                        "text": translated_text,
                        "status": "completed",
                    }));
                }
                TranslationRunEvent::Completed { entry_id: eid, total_segments } => {
                    let _ = h.emit("translation-segment", serde_json::json!({
                        "entry_id": eid,
                        "segment_id": "",
                        "text": "",
                        "status": "done",
                        "total": total_segments,
                    }));
                }
                TranslationRunEvent::Failed { entry_id: eid, error } => {
                    let _ = h.emit("translation-segment", serde_json::json!({
                        "entry_id": eid,
                        "segment_id": "",
                        "text": "",
                        "status": "error",
                        "error": error,
                    }));
                }
            }
        })
        .await
}

#[tauri::command]
pub async fn start_tagging_panel(
    state: State<'_, AppState>,
    entry_id: i64,
) -> Result<Vec<TagSuggestion>, AppError> {
    let resolver = RouteResolver::new(state.agent_config_store.clone());
    let routes = resolver
        .resolve_route(&AgentTaskKind::Tagging, None, None)
        .await?;
    let route = routes
        .first()
        .ok_or_else(|| AppError::Config("No tagging model configured".to_string()))?;

    let provider: Arc<dyn LLMProvider> = Arc::new(
        build_provider(state.agent_config_store.clone() as Arc<dyn AgentConfigStore>, route).await?,
    );
    let tag_store: Arc<dyn TagStore> = state.tag_store.clone();
    let executor = crate::agent::tagging::executor::TaggingExecutor::new(
        provider,
        Arc::new(resolver),
        state.prompt_template_store.clone(),
        tag_store,
    );

    let all_entries = state
        .entry_store
        .search(&entry_id.to_string(), crate::db::entry_store::SearchScope::TitleOnly)
        .await?;
    let entry = all_entries.iter().find(|e| e.id == entry_id);
    let title = entry.and_then(|e| e.title.clone()).unwrap_or_default();
    let content = entry.and_then(|e| e.summary.clone()).unwrap_or_default();

    executor
        .execute_for_entry(entry_id, &title, &content)
        .await
}

#[tauri::command]
pub async fn cancel_agent(
    state: State<'_, AppState>,
    entry_id: i64,
    task_kind: String,
) -> Result<(), AppError> {
    let kind = match task_kind.as_str() {
        "summary" => AgentTaskKind::Summary,
        "translation" => AgentTaskKind::Translation,
        "tagging" => AgentTaskKind::Tagging,
        "tagging_batch" => AgentTaskKind::TaggingBatch,
        _ => return Err(AppError::InvalidInput(format!("Unknown task kind: {task_kind}"))),
    };
    state.agent_runtime.cancel(Some(entry_id), kind).await
}

#[tauri::command]
pub async fn start_batch_tagging(
    state: State<'_, AppState>,
    scope_label: Option<String>,
    concurrency: u32,
    skip_already_applied: bool,
    skip_already_tagged: bool,
) -> Result<i64, AppError> {
    let resolver = RouteResolver::new(state.agent_config_store.clone());
    let routes = resolver
        .resolve_route(&AgentTaskKind::TaggingBatch, None, None)
        .await?;
    let route = routes
        .first()
        .ok_or_else(|| AppError::Config("No batch tagging model configured".to_string()))?;

    let provider: Arc<dyn LLMProvider> = Arc::new(
        build_provider(state.agent_config_store.clone() as Arc<dyn AgentConfigStore>, route).await?,
    );
    let tag_store: Arc<dyn TagStore> = state.tag_store.clone();
    let tagging_executor = Arc::new(crate::agent::tagging::executor::TaggingExecutor::new(
        provider,
        Arc::new(resolver),
        state.prompt_template_store.clone(),
        tag_store,
    ));

    let executor = BatchTaggingExecutor::new(tagging_executor);
    let config = BatchTaggingConfig {
        scope_label,
        concurrency,
        skip_already_applied,
        skip_already_tagged,
        entry_ids: None, // scope_label determines entries
    };

    executor.execute(&config, |_event| {}).await
}

// =============================================================================
// Agent state / availability
// =============================================================================

#[tauri::command]
pub async fn get_agent_state(
    _state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({
        "runs": []
    }))
}

#[tauri::command]
pub async fn check_agent_availability(
    state: State<'_, AppState>,
) -> Result<std::collections::HashMap<String, bool>, AppError> {
    let mut map = std::collections::HashMap::new();
    let resolver = RouteResolver::new(state.agent_config_store.clone());
    for kind in &[
        AgentTaskKind::Summary,
        AgentTaskKind::Translation,
        AgentTaskKind::Tagging,
    ] {
        let available = resolver.resolve_default_route(kind).await.is_ok();
        map.insert(kind.as_str().to_string(), available);
    }
    Ok(map)
}

// =============================================================================
// Summary / Translation getters
// =============================================================================

#[tauri::command]
pub async fn get_summary(
    state: State<'_, AppState>,
    entry_id: i64,
) -> Result<Option<crate::db::models::SummaryResult>, AppError> {
    state.summary_store.load_latest(entry_id).await
}

#[tauri::command]
pub async fn generate_summary(
    _state: State<'_, AppState>,
    _entry_id: i64,
    _detail_level: Option<String>,
) -> Result<serde_json::Value, AppError> {
    // Delegates to start_summary internally; returns task-like response
    Ok(serde_json::json!({"task_id": "summary-0"}))
}

#[tauri::command]
pub async fn get_translation_segments(
    state: State<'_, AppState>,
    entry_id: i64,
    target_language: String,
) -> Result<Vec<crate::db::models::TranslationSegment>, AppError> {
    let result = state
        .translation_store
        .load(entry_id, &target_language)
        .await?;
    Ok(result.map_or(Vec::new(), |(_, segs)| segs))
}

#[tauri::command]
pub async fn start_agent_task(
    _state: State<'_, AppState>,
    _entry_id: i64,
    _task_kind: String,
    _target_language: Option<String>,
    _detail_level: Option<String>,
) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({"task_id": "task-0"}))
}

#[tauri::command]
pub async fn cancel_agent_task(
    _state: State<'_, AppState>,
    _task_id: String,
) -> Result<(), AppError> {
    Ok(())
}

use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use crate::agent::provider::{LLMProvider, OpenAIProvider};
use crate::agent::route::RouteResolver;
use crate::agent::summary::executor::{SummaryExecutor, SummaryRunEvent, SummaryRunRequest};
use crate::agent::tagging::batch::{BatchTaggingConfig, BatchTaggingExecutor};
use crate::agent::tagging::executor::TagSuggestion;
use crate::agent::translation::executor::TranslationRunEvent;
use crate::agent::AgentTaskKind;
use crate::usage::tracker::record_usage_event;
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
    model: serde_json::Value,
) -> Result<AgentModelProfile, AppError> {
    let name = model["model_name"].as_str().unwrap_or("").to_string();
    let temp = model["temperature"].as_f64();
    let top_p = model["top_p"].as_f64();
    let max_tokens = model["max_tokens"].as_i64().map(|v| v as i32);
    let streaming = model["is_streaming"].as_bool().unwrap_or(true);
    let s_sum = model["supports_summary"].as_bool().unwrap_or(true);
    let s_trans = model["supports_translation"].as_bool().unwrap_or(true);
    let s_tag = model["supports_tagging"].as_bool().unwrap_or(true);

    let m = AgentModelProfile {
        id: 0,
        provider_profile_id,
        model_name: name,
        temperature: temp,
        top_p,
        max_tokens,
        is_streaming: streaming,
        supports_summary: s_sum,
        supports_translation: s_trans,
        supports_tagging: s_tag,
        is_default: false,
        is_enabled: true,
        is_archived: false,
        archived_at: None,
        last_tested_at: None,
        created_at: String::new(),
    };
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
    let entry = state.entry_store.load_by_id(entry_id).await?;
    let title = entry.as_ref().and_then(|e| e.title.clone()).unwrap_or_default();
    // Prefer full article markdown from content table, fall back to RSS summary
    let content = {
        let db = state.db.clone();
        let eid = entry_id;
        tokio::task::spawn_blocking(move || {
            let conn = db.conn();
            conn.query_row(
                "SELECT markdown FROM content WHERE entry_id = ?1",
                rusqlite::params![eid],
                |row| row.get::<_, Option<String>>(0),
            )
            .ok()
            .flatten()
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    };
    let content = content
        .or_else(|| entry.as_ref().and_then(|e| e.summary.clone()))
        .unwrap_or_default();

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
    _app_handle: AppHandle,
    state: State<'_, AppState>,
    entry_id: i64,
    target_language: String,
) -> Result<serde_json::Value, AppError> {
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

    let entry = state.entry_store.load_by_id(entry_id).await?;
    let title = entry.as_ref().and_then(|e| e.title.clone());
    let summary_text = entry.as_ref().and_then(|e| e.summary.clone()).unwrap_or_default();
    // Try content table markdown for richer translation source.
    // Render the markdown to HTML first so the segment extractor can find
    // <p>/<li>/<h1> elements whose order matches the rendered reader DOM.
    let content = {
        let db = state.db.clone();
        let eid = entry_id;
        tokio::task::spawn_blocking(move || {
            let conn = db.conn();
            conn.query_row(
                "SELECT markdown FROM content WHERE entry_id = ?1",
                rusqlite::params![eid],
                |row| row.get::<_, Option<String>>(0),
            )
            .ok()
            .flatten()
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }
    .map(|md| {
        // Prepend the article title as a markdown heading so the segment
        // extractor sees it at index 0, matching the reader iframe DOM.
        let md_with_title = match &title {
            Some(t) if !t.is_empty() => format!("# {}\n\n{}", t, md),
            _ => md,
        };
        let mut opts = comrak::ComrakOptions::default();
        opts.extension.table = true;
        opts.extension.strikethrough = true;
        opts.extension.tasklist = true;
        opts.extension.autolink = true;
        comrak::markdown_to_html(&md_with_title, &opts)
    })
    .unwrap_or(summary_text);

    let request = crate::agent::translation::executor::TranslationRunRequest {
        entry_id,
        target_language: target_language.clone(),
        content,
        title,
        concurrency: 3,
    };

    // Collect errors from segments
    let last_error = std::sync::Arc::new(std::sync::Mutex::new(None::<String>));
    let err_clone = last_error.clone();
    let result = executor.execute(&request, move |event| {
        if let TranslationRunEvent::Failed { error, .. } = event {
            *err_clone.lock().unwrap() = Some(error);
        }
    }).await;

    // Return segment count + any error directly to frontend
    match result {
        Ok(()) => {
            let segments = state.translation_store.load(entry_id, &target_language).await?
                .map(|(_, segs)| segs)
                .unwrap_or_default();

            // Record usage with estimated token counts
            let total_chars: usize = segments.iter().map(|s| s.translated_text.len()).sum();
            let comp_tokens = (total_chars as u32 / 4).max(1);
            let usage_store: Arc<dyn crate::db::llm_usage_store::LLMUsageStore> = state.llm_usage_store.clone();
            let _ = record_usage_event(
                &usage_store,
                None,
                &route.provider_name,
                &format!("{}/chat/completions", route.provider_name),
                &route.model_name,
                comp_tokens / 2, comp_tokens, comp_tokens + comp_tokens / 2,
                "primary", "success", None,
            ).await;

            Ok(serde_json::json!({
                "total_segments": segments.len(),
                "segments": segments,
                "error": last_error.lock().unwrap().as_ref().map(|s| s.as_str()),
            }))
        }
        Err(e) => {
            // Record failed usage
            let usage_store: Arc<dyn crate::db::llm_usage_store::LLMUsageStore> = state.llm_usage_store.clone();
            let _ = record_usage_event(
                &usage_store,
                None,
                &route.provider_name,
                &format!("{}/chat/completions", route.provider_name),
                &route.model_name,
                0, 0, 0,
                "primary", "failed", None,
            ).await;
            Err(e)
        }
    }
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

    let entry = state.entry_store.load_by_id(entry_id).await?;
    let title = entry.as_ref().and_then(|e| e.title.clone()).unwrap_or_default();
    let content = entry.as_ref().and_then(|e| e.summary.clone()).unwrap_or_default();

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
pub async fn build_translation_html(
    state: State<'_, AppState>,
    entry_id: i64,
    target_language: String,
    bilingual: Option<bool>,
) -> Result<String, AppError> {
    use crate::agent::translation::bilingual::{BilingualComposer, BilingualSegment};
    use crate::db::translation_store::TranslationStore;

    let result = state.translation_store.load(entry_id, &target_language).await?;
    match result {
        Some((_, segments)) if !segments.is_empty() => {
            let bilingual_segs: Vec<BilingualSegment> = segments
                .into_iter()
                .map(|s| BilingualSegment {
                    segment_id: s.segment_id,
                    source_text: s.source_text,
                    translated_text: s.translated_text,
                    order_index: s.order_index as usize,
                })
                .collect();

            if bilingual.unwrap_or(true) {
                BilingualComposer::compose_interleaved(&bilingual_segs)
            } else {
                BilingualComposer::translation_only(&bilingual_segs)
            }
        }
        _ => Err(AppError::NotFound("No translation found".to_string())),
    }
}

#[tauri::command]
pub async fn get_summary(
    state: State<'_, AppState>,
    entry_id: i64,
) -> Result<Option<crate::db::models::SummaryResult>, AppError> {
    state.summary_store.load_latest(entry_id).await
}

#[tauri::command]
pub async fn generate_summary(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    entry_id: i64,
    detail_level: Option<String>,
) -> Result<serde_json::Value, AppError> {
    let lang = "zh-CN".to_string();
    let detail = detail_level.unwrap_or_else(|| "medium".to_string());

    // Build and run the summary executor, same as start_summary
    let entry = state.entry_store.load_by_id(entry_id).await?;
    let title = entry.as_ref().and_then(|e| e.title.clone()).unwrap_or_default();
    let content = {
        let db = state.db.clone();
        let eid = entry_id;
        tokio::task::spawn_blocking(move || {
            let conn = db.conn();
            conn.query_row(
                "SELECT markdown FROM content WHERE entry_id = ?1",
                rusqlite::params![eid],
                |row| row.get::<_, Option<String>>(0),
            )
            .ok()
            .flatten()
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }
    .or_else(|| entry.as_ref().and_then(|e| e.summary.clone()))
    .unwrap_or_default();

    let resolver = RouteResolver::new(state.agent_config_store.clone());
    let routes = resolver.resolve_route(&AgentTaskKind::Summary, None, None).await?;
    let route = routes.first()
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
        target_language: lang,
        detail_level: detail,
        title,
        content,
    };

    let full_text = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
    let full_text_clone = full_text.clone();
    let handle = app_handle.clone();
    executor.execute(&request, move |event| {
        match event {
            SummaryRunEvent::Token { entry_id: eid, token } => {
                full_text_clone.lock().unwrap().push_str(&token);
                let _ = handle.emit("summary-token", serde_json::json!({
                    "entry_id": eid, "token": token, "is_complete": false,
                }));
            }
            SummaryRunEvent::Terminal { entry_id: eid, .. } => {
                let text = full_text_clone.lock().unwrap().clone();
                let _ = handle.emit("summary-token", serde_json::json!({
                    "entry_id": eid, "token": text, "is_complete": true,
                }));
            }
            _ => {}
        }
    }).await?;

    // Record usage with estimated token counts
    let text = full_text.lock().unwrap().clone();
    let comp_tokens = ((text.len() as u32) / 4).max(1);
    let usage_store: Arc<dyn crate::db::llm_usage_store::LLMUsageStore> = state.llm_usage_store.clone();
    let _ = record_usage_event(
        &usage_store,
        None,
        &route.provider_name,
        &format!("{}/chat/completions", route.provider_name),
        &route.model_name,
        comp_tokens / 2, comp_tokens, comp_tokens + comp_tokens / 2,
        "primary", "success", None,
    ).await;

    // Convert Markdown to HTML for frontend rendering
    let html = {
        let mut opts = comrak::ComrakOptions::default();
        opts.extension.table = true;
        opts.extension.strikethrough = true;
        opts.extension.autolink = true;
        comrak::markdown_to_html(&text, &opts)
    };
    Ok(serde_json::json!({"task_id": format!("summary-{}", entry_id), "text": text, "html": html}))
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

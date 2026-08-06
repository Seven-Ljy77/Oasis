use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use crate::agent::provider::{validate_provider_base_url, LLMMessage, LLMProvider, LLMRequest, OpenAIProvider};
use crate::agent::request_tracker::AgentRequestSlot;
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

fn validate_provider(provider: &mut AgentProviderProfile) -> Result<(), AppError> {
    provider.name = provider.name.trim().to_string();
    provider.base_url = provider.base_url.trim().trim_end_matches('/').to_string();
    if provider.name.is_empty() {
        return Err(AppError::InvalidInput(
            "Provider name cannot be empty".to_string(),
        ));
    }
    validate_provider_base_url(&provider.base_url)?;
    Ok(())
}

#[cfg(test)]
fn provider_origin(base_url: &str) -> Result<url::Origin, AppError> {
    url::Url::parse(base_url)
        .map(|parsed| parsed.origin())
        .map_err(|error| AppError::InvalidInput(format!("Invalid provider URL: {error}")))
}

fn redact_provider(mut provider: AgentProviderProfile) -> AgentProviderProfile {
    if provider.api_key_ref != "local" {
        provider.api_key_ref = "stored".to_string();
    }
    provider
}

fn validate_model(model: &mut AgentModelProfile) -> Result<(), AppError> {
    model.model_name = model.model_name.trim().to_string();
    if model.model_name.is_empty() {
        return Err(AppError::InvalidInput(
            "Model name cannot be empty".to_string(),
        ));
    }
    if model.temperature.is_some_and(|value| !(0.0..=2.0).contains(&value)) {
        return Err(AppError::InvalidInput(
            "Temperature must be between 0 and 2".to_string(),
        ));
    }
    if model.top_p.is_some_and(|value| !(0.0..=1.0).contains(&value)) {
        return Err(AppError::InvalidInput(
            "Top-p must be between 0 and 1".to_string(),
        ));
    }
    if model.max_tokens.is_some_and(|value| value <= 0) {
        return Err(AppError::InvalidInput(
            "Max tokens must be greater than zero".to_string(),
        ));
    }
    Ok(())
}

fn can_try_fallback(error: &AppError) -> bool {
    matches!(
        error,
        AppError::Agent(_)
            | AppError::Config(_)
            | AppError::NotFound(_)
            | AppError::Unauthorized(_)
            | AppError::Network(_)
            | AppError::Timeout(_)
    )
}

fn render_summary_html(markdown: &str) -> String {
    let mut options = comrak::ComrakOptions::default();
    options.extension.table = true;
    options.extension.strikethrough = true;
    options.extension.autolink = true;
    comrak::markdown_to_html(markdown, &options)
}

async fn persist_api_key(api_key: String) -> Result<String, AppError> {
    let key = api_key.trim().to_string();
    if key.is_empty() || key == "local" {
        return Ok("local".to_string());
    }
    // API keys are intentionally stored in Oasis's local SQLite database.
    // Provider responses redact this value before returning it to the frontend.
    Ok(key)
}

// =============================================================================
// Provider CRUD
// =============================================================================

#[tauri::command]
pub async fn get_agent_providers(
    state: State<'_, AppState>,
) -> Result<Vec<AgentProviderProfile>, AppError> {
    Ok(state
        .agent_config_store
        .load_providers(false)
        .await?
        .into_iter()
        .map(redact_provider)
        .collect())
}

#[tauri::command]
pub async fn add_agent_provider(
    state: State<'_, AppState>,
    name: String,
    base_url: String,
    api_key: String,
    test_model: Option<String>,
) -> Result<AgentProviderProfile, AppError> {
    let mut provider = AgentProviderProfile {
        id: 0,
        name,
        base_url,
        api_key_ref: "local".to_string(),
        test_model,
        is_default: false,
        is_enabled: true,
        is_archived: false,
        archived_at: None,
        created_at: String::new(),
    };
    validate_provider(&mut provider)?;
    let api_key_ref = persist_api_key(api_key).await?;
    provider.api_key_ref = api_key_ref.clone();
    match state.agent_config_store.upsert_provider(&provider).await {
        Ok(stored) => Ok(redact_provider(stored)),
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub async fn update_agent_provider(
    state: State<'_, AppState>,
    provider_profile_id: i64,
    updates: serde_json::Value,
) -> Result<AgentProviderProfile, AppError> {
    let mut provider = state
        .agent_config_store
        .load_providers(true)
        .await?
        .into_iter()
        .find(|provider| provider.id == provider_profile_id)
        .ok_or_else(|| {
            AppError::NotFound(format!("Provider not found: {provider_profile_id}"))
        })?;
    if let Some(value) = updates.get("name") {
        provider.name = value
            .as_str()
            .ok_or_else(|| AppError::InvalidInput("Provider name must be text".to_string()))?
            .to_string();
    }
    if let Some(value) = updates.get("base_url") {
        provider.base_url = value
            .as_str()
            .ok_or_else(|| AppError::InvalidInput("Provider URL must be text".to_string()))?
            .to_string();
    }
    if let Some(value) = updates.get("api_key_ref") {
        let submitted_reference = value
            .as_str()
            .ok_or_else(|| AppError::InvalidInput("API key reference must be text".to_string()))?
            .to_string();
        if submitted_reference != "stored" && submitted_reference != provider.api_key_ref {
            return Err(AppError::InvalidInput(
                "API key references cannot be changed directly".to_string(),
            ));
        }
    }
    if updates.get("api_key").is_some() || updates.get("apiKey").is_some() {
        return Err(AppError::InvalidInput(
            "To change an API key, delete this provider and create it again".to_string(),
        ));
    }
    if let Some(value) = updates.get("test_model") {
        provider.test_model = if value.is_null() {
            None
        } else {
            Some(
                value
                    .as_str()
                    .ok_or_else(|| {
                        AppError::InvalidInput("Test model must be text".to_string())
                    })?
                    .to_string(),
            )
        };
    }
    if let Some(value) = updates.get("is_default") {
        provider.is_default = value.as_bool().ok_or_else(|| {
            AppError::InvalidInput("Provider default flag must be boolean".to_string())
        })?;
    }
    if let Some(value) = updates.get("is_enabled") {
        provider.is_enabled = value.as_bool().ok_or_else(|| {
            AppError::InvalidInput("Provider enabled flag must be boolean".to_string())
        })?;
    }
    validate_provider(&mut provider)?;
    state
        .agent_config_store
        .upsert_provider(&provider)
        .await
        .map(redact_provider)
}

#[cfg(test)]
mod provider_validation_tests {
    use super::{provider_origin, validate_provider};
    use crate::db::models::AgentProviderProfile;

    fn provider(base_url: &str) -> AgentProviderProfile {
        AgentProviderProfile {
            id: 0,
            name: "Provider".to_string(),
            base_url: base_url.to_string(),
            api_key_ref: "local".to_string(),
            test_model: None,
            is_default: false,
            is_enabled: true,
            is_archived: false,
            archived_at: None,
            created_at: String::new(),
        }
    }

    #[test]
    fn http_provider_must_be_loopback() {
        assert!(validate_provider(&mut provider("http://localhost:11434/v1")).is_ok());
        assert!(validate_provider(&mut provider("http://127.0.0.1:11434/v1")).is_ok());
        assert!(validate_provider(&mut provider("http://[::1]:11434/v1")).is_ok());
        assert!(validate_provider(&mut provider("http://example.com/v1")).is_err());
        assert!(validate_provider(&mut provider("https://example.com/v1")).is_ok());
    }

    #[test]
    fn provider_origin_ignores_path_but_not_host_or_scheme() {
        assert_eq!(
            provider_origin("https://example.com/v1").unwrap(),
            provider_origin("https://example.com/compatible/v1").unwrap()
        );
        assert_ne!(
            provider_origin("https://example.com/v1").unwrap(),
            provider_origin("https://api.example.com/v1").unwrap()
        );
    }
}

#[tauri::command]
pub async fn delete_agent_provider(
    state: State<'_, AppState>,
    provider_profile_id: i64,
) -> Result<(), AppError> {
    state.agent_config_store.delete_provider(provider_profile_id).await
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
    state: State<'_, AppState>,
    provider_profile_id: i64,
) -> Result<(), AppError> {
    state
        .agent_config_store
        .unarchive_provider(provider_profile_id)
        .await
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
    let max_tokens = model["max_tokens"]
        .as_i64()
        .map(i32::try_from)
        .transpose()
        .map_err(|_| AppError::InvalidInput("Max tokens is out of range".to_string()))?;
    let streaming = model["is_streaming"].as_bool().unwrap_or(true);
    let s_sum = model["supports_summary"].as_bool().unwrap_or(true);
    let s_trans = model["supports_translation"].as_bool().unwrap_or(true);
    let s_tag = model["supports_tagging"].as_bool().unwrap_or(true);

    let mut m = AgentModelProfile {
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
    validate_model(&mut m)?;
    state.agent_config_store.upsert_model(&m).await
}

#[tauri::command]
pub async fn update_agent_model(
    state: State<'_, AppState>,
    model_profile_id: i64,
    updates: serde_json::Value,
) -> Result<AgentModelProfile, AppError> {
    let providers = state.agent_config_store.load_providers(true).await?;
    let mut model = None;
    for provider in providers {
        if let Some(found) = state
            .agent_config_store
            .load_models(provider.id, true)
            .await?
            .into_iter()
            .find(|candidate| candidate.id == model_profile_id)
        {
            model = Some(found);
            break;
        }
    }
    let mut model = model
        .ok_or_else(|| AppError::NotFound(format!("Model not found: {model_profile_id}")))?;
    if let Some(value) = updates.get("model_name") {
        model.model_name = value
            .as_str()
            .ok_or_else(|| AppError::InvalidInput("Model name must be text".to_string()))?
            .to_string();
    }
    if let Some(value) = updates.get("temperature") {
        model.temperature = if value.is_null() {
            None
        } else {
            Some(value.as_f64().ok_or_else(|| {
                AppError::InvalidInput("Temperature must be numeric".to_string())
            })?)
        };
    }
    if let Some(value) = updates.get("top_p") {
        model.top_p = if value.is_null() {
            None
        } else {
            Some(
                value
                    .as_f64()
                    .ok_or_else(|| AppError::InvalidInput("Top-p must be numeric".to_string()))?,
            )
        };
    }
    if let Some(value) = updates.get("max_tokens") {
        model.max_tokens = if value.is_null() {
            None
        } else {
            Some(
                value
                    .as_i64()
                    .and_then(|number| i32::try_from(number).ok())
                    .ok_or_else(|| {
                        AppError::InvalidInput("Max tokens must be an integer".to_string())
                    })?,
            )
        };
    }
    for (key, target) in [
        ("is_streaming", &mut model.is_streaming),
        ("supports_summary", &mut model.supports_summary),
        ("supports_translation", &mut model.supports_translation),
        ("supports_tagging", &mut model.supports_tagging),
        ("is_default", &mut model.is_default),
        ("is_enabled", &mut model.is_enabled),
    ] {
        if let Some(value) = updates.get(key) {
            *target = value.as_bool().ok_or_else(|| {
                AppError::InvalidInput(format!("{key} must be boolean"))
            })?;
        }
    }
    validate_model(&mut model)?;
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
            client.complete(&request).await?;
            return Ok(true);
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
    let request_context = state
        .agent_request_tracker
        .begin(AgentRequestSlot::summary(entry_id, &language, &detail))
        .await;
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

    let resolver = Arc::new(RouteResolver::new(state.agent_config_store.clone()));
    let routes = resolver
        .resolve_route(&AgentTaskKind::Summary, None, None)
        .await?;
    if routes.is_empty() {
        return Err(AppError::Config(
            "No model configured. Go to Settings \u{2192} Agents to set up a model.".to_string(),
        ));
    }

    let request = SummaryRunRequest {
        entry_id,
        target_language: language,
        detail_level: detail,
        force: false,
        title,
        content,
    };

    let mut last_error = None;
    for (index, route) in routes.iter().enumerate() {
        request_context.ensure_current().await?;
        let provider: Arc<dyn LLMProvider> = Arc::new(
            build_provider(
                state.agent_config_store.clone() as Arc<dyn AgentConfigStore>,
                route,
            )
            .await?,
        );
        let executor = SummaryExecutor::new(
            provider,
            resolver.clone(),
            state.prompt_template_store.clone(),
            state.summary_store.clone(),
        );
        let handle = app_handle.clone();
        let result = executor
            .execute(&request, Some(&request_context), Some(route), move |event| {
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
            .await;
        match result {
            Ok(()) => return Ok(()),
            Err(error) if index + 1 < routes.len() && can_try_fallback(&error) => {
                last_error = Some(error);
            }
            Err(error) => return Err(error),
        }
    }
    Err(last_error.unwrap_or_else(|| {
        AppError::Config("No model configured. Go to Settings \u{2192} Agents to set up a model.".to_string())
    }))
}

#[tauri::command]
pub async fn start_translation(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    entry_id: i64,
    target_language: String,
    concurrency: Option<u32>,
    request_id: String,
) -> Result<serde_json::Value, AppError> {
    let request_context = state
        .agent_request_tracker
        .begin(AgentRequestSlot::translation(entry_id, &target_language))
        .await;
    let resolver = Arc::new(RouteResolver::new(state.agent_config_store.clone()));
    let routes = resolver
        .resolve_route(&AgentTaskKind::Translation, None, None)
        .await?;
    if routes.is_empty() {
        return Err(AppError::Config(
            "No model configured. Go to Settings \u{2192} Agents to set up a model.".to_string(),
        ));
    }

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
        let mut opts = comrak::ComrakOptions::default();
        opts.extension.table = true;
        opts.extension.strikethrough = true;
        opts.extension.tasklist = true;
        opts.extension.autolink = true;
        comrak::markdown_to_html(&md, &opts)
    })
    .unwrap_or(summary_text);

    let request = crate::agent::translation::executor::TranslationRunRequest {
        entry_id,
        target_language: target_language.clone(),
        content,
        title,
        concurrency: concurrency.unwrap_or(3).clamp(1, 5),
    };

    let mut used_route_index = 0;
    let mut result = Err(AppError::Config(
        "No model configured. Go to Settings \u{2192} Agents to set up a model.".to_string(),
    ));
    for (index, route) in routes.iter().enumerate() {
        request_context.ensure_current().await?;
        used_route_index = index;
        let provider: Arc<dyn LLMProvider> = Arc::new(
            build_provider(
                state.agent_config_store.clone() as Arc<dyn AgentConfigStore>,
                route,
            )
            .await?,
        );
        let executor = crate::agent::translation::executor::TranslationExecutor::new(
            provider,
            resolver.clone(),
            state.prompt_template_store.clone(),
            state.translation_store.clone(),
        );
        let event_handle = app_handle.clone();
        let event_request_id = request_id.clone();
        let event_target_language = target_language.clone();
        let attempt = executor
            .execute(
                &request,
                Some(&request_context),
                Some(route),
                move |event| match event {
                    TranslationRunEvent::Started { entry_id } => {
                        let _ = event_handle.emit("translation-progress", serde_json::json!({
                            "entry_id": entry_id,
                            "request_id": event_request_id.clone(),
                            "target_language": event_target_language.clone(),
                            "status": "started",
                        }));
                    }
                    TranslationRunEvent::SegmentCompleted {
                        entry_id,
                        segment_id,
                        order_index,
                        translated_text,
                        total_segments,
                    } => {
                        let _ = event_handle.emit("translation-progress", serde_json::json!({
                            "entry_id": entry_id,
                            "request_id": event_request_id.clone(),
                            "target_language": event_target_language.clone(),
                            "status": "segment_completed",
                            "segment_id": segment_id,
                            "order_index": order_index,
                            "translated_text": translated_text,
                            "total_segments": total_segments,
                        }));
                    }
                    TranslationRunEvent::Completed {
                        entry_id,
                        total_segments,
                    } => {
                        let _ = event_handle.emit("translation-progress", serde_json::json!({
                            "entry_id": entry_id,
                            "request_id": event_request_id.clone(),
                            "target_language": event_target_language.clone(),
                            "status": "completed",
                            "total_segments": total_segments,
                        }));
                    }
                    TranslationRunEvent::Failed { entry_id, error } => {
                        let _ = event_handle.emit("translation-progress", serde_json::json!({
                            "entry_id": entry_id,
                            "request_id": event_request_id.clone(),
                            "target_language": event_target_language.clone(),
                            "status": "failed",
                            "error": error,
                        }));
                    }
                },
            )
            .await;
        match attempt {
            Ok(()) => {
                result = Ok(());
                break;
            }
            Err(error) if index + 1 < routes.len() && can_try_fallback(&error) => {
                result = Err(error);
            }
            Err(error) => {
                result = Err(error);
                break;
            }
        }
    }
    let route = &routes[used_route_index];

    // Return segment count + any error directly to frontend
    match result {
        Ok(()) => {
            let segments = state.translation_store.load(entry_id, &target_language).await?
                .map(|(_, segs)| segs)
                .unwrap_or_default();

            // Record usage with estimated token counts
            let total_chars: usize = segments.iter().map(|s| s.translated_text.len()).sum();
            let comp_tokens = (total_chars as u32 / 4).max(1);
            let request_phase = if route.is_fallback { "fallback" } else { "primary" };
            let endpoint_url = format!(
                "{}/chat/completions",
                route.provider_base_url.trim_end_matches('/')
            );
            let usage_store: Arc<dyn crate::db::llm_usage_store::LLMUsageStore> = state.llm_usage_store.clone();
            let _ = record_usage_event(
                &usage_store,
                None,
                &route.provider_name,
                &route.provider_base_url,
                &route.model_name,
                comp_tokens / 2, comp_tokens, comp_tokens + comp_tokens / 2,
                request_phase, "success", Some(&endpoint_url),
            ).await;

            Ok(serde_json::json!({
                "total_segments": segments.len(),
                "segments": segments,
                "error": null,
            }))
        }
        Err(e) => {
            let _ = app_handle.emit("translation-progress", serde_json::json!({
                "entry_id": entry_id,
                "request_id": request_id,
                "target_language": target_language,
                "status": "failed",
                "error": e.to_string(),
            }));
            // Record failed usage
            let request_phase = if route.is_fallback { "fallback" } else { "primary" };
            let endpoint_url = format!(
                "{}/chat/completions",
                route.provider_base_url.trim_end_matches('/')
            );
            let usage_store: Arc<dyn crate::db::llm_usage_store::LLMUsageStore> = state.llm_usage_store.clone();
            let _ = record_usage_event(
                &usage_store,
                None,
                &route.provider_name,
                &route.provider_base_url,
                &route.model_name,
                0, 0, 0,
                request_phase, "failed", Some(&endpoint_url),
            ).await;
            Err(e)
        }
    }
}

/// Translate a single piece of text (word, phrase, or sentence).
/// Returns the translated text directly — no segments, no database writes.
#[tauri::command]
pub async fn translate_text(
    state: State<'_, AppState>,
    text: String,
    target_language: String,
) -> Result<String, AppError> {
    let resolver = RouteResolver::new(state.agent_config_store.clone());
    let routes = resolver
        .resolve_route(&AgentTaskKind::Translation, None, None)
        .await?;
    let route = routes
        .first()
        .ok_or_else(|| AppError::Config("No model configured. Go to Settings \u{2192} Agents to set up a model.".to_string()))?;

    let provider = build_provider(
        state.agent_config_store.clone() as Arc<dyn AgentConfigStore>,
        route,
    )
    .await?;

    let user = format!(
        "Translate the following text into {}. Output only the translation, nothing else.\n\n{}",
        target_language, text
    );

    let request = LLMRequest {
        model: route.model_name.clone(),
        messages: vec![LLMMessage {
            role: "user".to_string(),
            content: user,
        }],
        temperature: Some(0.3),
        top_p: Some(0.95),
        max_tokens: Some(1000),
        stream: false,
    };

    let response = provider.complete(&request).await?;
    Ok(response.content)
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
        .ok_or_else(|| AppError::Config("No model configured. Go to Settings \u{2192} Agents to set up a model.".to_string()))?;

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
    entry_ids: Vec<i64>,
    scope_label: Option<String>,
    concurrency: Option<u32>,
    skip_already_applied: Option<bool>,
    skip_already_tagged: Option<bool>,
) -> Result<i64, AppError> {
    let resolver = RouteResolver::new(state.agent_config_store.clone());
    let routes = resolver
        .resolve_route(&AgentTaskKind::TaggingBatch, None, None)
        .await?;
    let route = routes
        .first()
        .ok_or_else(|| AppError::Config("No model configured. Go to Settings \u{2192} Agents to set up a model.".to_string()))?;

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
        concurrency: concurrency.unwrap_or(3).clamp(1, 5),
        skip_already_applied: skip_already_applied.unwrap_or(true),
        skip_already_tagged: skip_already_tagged.unwrap_or(false),
        entry_ids: Some(entry_ids),
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
        "active_runs": [],
        "waiting_count": 0
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
    target_language: String,
    detail_level: String,
) -> Result<Option<serde_json::Value>, AppError> {
    let result = state
        .summary_store
        .load_by_slot(entry_id, &target_language, &detail_level)
        .await?;
    result
        .map(|summary| {
            let html = render_summary_html(&summary.text);
            let mut value = serde_json::to_value(summary)
                .map_err(|error| AppError::Agent(format!("Cannot serialize summary: {error}")))?;
            value["html"] = serde_json::Value::String(html);
            Ok(value)
        })
        .transpose()
}

#[tauri::command]
pub async fn generate_summary(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    entry_id: i64,
    target_language: String,
    detail_level: Option<String>,
    request_id: String,
    force: Option<bool>,
) -> Result<serde_json::Value, AppError> {
    let detail = detail_level.unwrap_or_else(|| "medium".to_string());
    let request_context = state
        .agent_request_tracker
        .begin(AgentRequestSlot::summary(
            entry_id,
            &target_language,
            &detail,
        ))
        .await;

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

    let resolver = Arc::new(RouteResolver::new(state.agent_config_store.clone()));
    let routes = resolver.resolve_route(&AgentTaskKind::Summary, None, None).await?;
    if routes.is_empty() {
        return Err(AppError::Config(
            "No model configured. Go to Settings \u{2192} Agents to set up a model.".to_string(),
        ));
    }

    let request = SummaryRunRequest {
        entry_id,
        target_language,
        detail_level: detail,
        force: force.unwrap_or(false),
        title,
        content,
    };

    let full_text = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
    let mut used_route_index = 0;
    let mut last_error = None;
    for (index, route) in routes.iter().enumerate() {
        request_context.ensure_current().await?;
        used_route_index = index;
        let provider: Arc<dyn LLMProvider> = Arc::new(
            build_provider(
                state.agent_config_store.clone() as Arc<dyn AgentConfigStore>,
                route,
            )
            .await?,
        );
        let executor = SummaryExecutor::new(
            provider,
            resolver.clone(),
            state.prompt_template_store.clone(),
            state.summary_store.clone(),
        );
        let full_text_clone = full_text.clone();
        let handle = app_handle.clone();
        let event_request_id = request_id.clone();
        let event_target_language = request.target_language.clone();
        let event_detail_level = request.detail_level.clone();
        let attempt = executor
            .execute(
                &request,
                Some(&request_context),
                Some(route),
                move |event| match event {
                    SummaryRunEvent::Started { entry_id: eid } => {
                        full_text_clone.lock().unwrap().clear();
                        let _ = handle.emit("summary-token", serde_json::json!({
                            "entry_id": eid,
                            "request_id": event_request_id.clone(),
                            "target_language": event_target_language.clone(),
                            "detail_level": event_detail_level.clone(),
                            "token": "",
                            "reset": true,
                            "is_complete": false,
                        }));
                    }
                    SummaryRunEvent::Token { entry_id: eid, token } => {
                        full_text_clone.lock().unwrap().push_str(&token);
                        let _ = handle.emit("summary-token", serde_json::json!({
                            "entry_id": eid,
                            "request_id": event_request_id.clone(),
                            "target_language": event_target_language.clone(),
                            "detail_level": event_detail_level.clone(),
                            "token": token,
                            "reset": false,
                            "is_complete": false,
                        }));
                    }
                    SummaryRunEvent::Terminal { entry_id: eid, full_text, .. } => {
                        *full_text_clone.lock().unwrap() = full_text.clone();
                        let _ = handle.emit("summary-token", serde_json::json!({
                            "entry_id": eid,
                            "request_id": event_request_id.clone(),
                            "target_language": event_target_language.clone(),
                            "detail_level": event_detail_level.clone(),
                            "token": full_text,
                            "reset": false,
                            "is_complete": true,
                        }));
                    }
                },
            )
            .await;
        match attempt {
            Ok(()) => {
                last_error = None;
                break;
            }
            Err(error) if index + 1 < routes.len() && can_try_fallback(&error) => {
                last_error = Some(error);
            }
            Err(error) => return Err(error),
        }
    }
    if let Some(error) = last_error {
        return Err(error);
    }
    let route = &routes[used_route_index];

    // Record usage with estimated token counts
    let text = full_text.lock().unwrap().clone();
    let comp_tokens = ((text.len() as u32) / 4).max(1);
    let request_phase = if route.is_fallback { "fallback" } else { "primary" };
    let endpoint_url = format!(
        "{}/chat/completions",
        route.provider_base_url.trim_end_matches('/')
    );
    let usage_store: Arc<dyn crate::db::llm_usage_store::LLMUsageStore> = state.llm_usage_store.clone();
    let _ = record_usage_event(
        &usage_store,
        None,
        &route.provider_name,
        &route.provider_base_url,
        &route.model_name,
        comp_tokens / 2, comp_tokens, comp_tokens + comp_tokens / 2,
        request_phase, "success", Some(&endpoint_url),
    ).await;

    let html = render_summary_html(&text);
    let saved = state
        .summary_store
        .load_by_slot(
            request.entry_id,
            &request.target_language,
            &request.detail_level,
        )
        .await?
        .ok_or_else(|| AppError::Agent("Generated summary was not persisted".to_string()))?;
    Ok(serde_json::json!({
        "task_id": format!("summary-{}", entry_id),
        "text": text,
        "html": html,
        "result": saved,
    }))
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
    Err(AppError::Agent(
        "Generic agent task dispatch is not implemented; use the task-specific command"
            .to_string(),
    ))
}

#[tauri::command]
pub async fn cancel_agent_task(
    _state: State<'_, AppState>,
    _task_id: String,
) -> Result<(), AppError> {
    Err(AppError::Agent(
        "Generic agent task cancellation is not implemented".to_string(),
    ))
}

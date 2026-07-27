use tauri::State;

use crate::agent::provider::{LLMProvider, OpenAIProvider};
use crate::error::AppError;
use crate::state::{AppConfig, AppState};
use crate::usage::retention::{self, RetentionPolicy};

fn config_path() -> std::path::PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Oasis")
        .join("oasis-config.json")
}

/// Load config from disk, falling back to defaults.
pub fn load_config_from_disk() -> AppConfig {
    let path = config_path();
    if path.exists() {
        if let Ok(json) = std::fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str::<AppConfig>(&json) {
                return config;
            }
        }
    }
    AppConfig::default()
}

/// Persist config to disk.
fn save_config_to_disk(config: &AppConfig) -> Result<(), AppError> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| AppError::Config(format!("Failed to serialize settings: {e}")))?;
    std::fs::write(&path, json)
        .map_err(|e| AppError::Config(format!("Failed to write settings file: {e}")))?;
    Ok(())
}

#[tauri::command]
pub async fn load_settings(
    state: State<'_, AppState>,
) -> Result<AppConfig, AppError> {
    // Load from disk first, update in-memory state
    let disk_config = tokio::task::spawn_blocking(load_config_from_disk)
        .await
        .map_err(|e| AppError::Unknown(format!("{e}")))?;
    let mut current = state.config.write().await;
    *current = disk_config.clone();
    Ok(disk_config)
}

#[tauri::command]
pub async fn save_settings(
    state: State<'_, AppState>,
    settings: AppConfig,
) -> Result<(), AppError> {
    let retention_months = settings.usage_retention_months;
    {
        let mut current = state.config.write().await;
        *current = settings.clone();
    }

    // Persist to disk
    let settings_clone = settings.clone();
    tokio::task::spawn_blocking(move || save_config_to_disk(&settings_clone))
        .await
        .map_err(|e| AppError::Unknown(format!("{e}")))??;

    // Apply retention policy immediately
    let policy = match retention_months {
        Some(n) => RetentionPolicy::Months(n),
        None => RetentionPolicy::Forever,
    };
    let store = state.llm_usage_store.clone();
    tokio::spawn(async move {
        let _ = retention::purge_expired(&(store as std::sync::Arc<dyn crate::db::llm_usage_store::LLMUsageStore>), &policy).await;
    });

    Ok(())
}

#[tauri::command]
pub async fn test_provider_connection(
    _state: State<'_, AppState>,
    provider_name: String,
    model_name: String,
    api_key: String,
    base_url: String,
) -> Result<bool, AppError> {
    let provider = OpenAIProvider::new(provider_name, base_url, api_key);
    let request = crate::agent::provider::LLMRequest {
        model: model_name,
        messages: vec![crate::agent::provider::LLMMessage {
            role: "user".to_string(),
            content: "Hi".to_string(),
        }],
        temperature: None,
        top_p: None,
        max_tokens: Some(1),
        stream: false,
    };
    match provider.complete(&request).await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn reveal_custom_template(
    _state: State<'_, AppState>,
    template_id: String,
) -> Result<(), AppError> {
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Oasis")
        .join("prompts");
    std::fs::create_dir_all(&data_dir).ok();
    let path = data_dir.join(format!("{template_id}"));
    // Create default template if it doesn't exist
    if !path.exists() {
        let default = include_str!("../../resources/templates/single-markdown.yaml");
        std::fs::write(&path, default)
            .map_err(|e| AppError::Config(format!("Cannot create template: {e}")))?;
    }
    open::that(&path)
        .map_err(|e| AppError::Config(format!("Cannot open template file: {e}")))?;
    Ok(())
}

#[tauri::command]
pub async fn get_settings(
    state: State<'_, AppState>,
) -> Result<AppConfig, AppError> {
    Ok(state.config.read().await.clone())
}

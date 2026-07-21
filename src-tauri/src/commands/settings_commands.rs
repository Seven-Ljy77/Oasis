use tauri::State;

use crate::agent::provider::{LLMProvider, OpenAIProvider};
use crate::error::AppError;
use crate::state::{AppConfig, AppState};
use crate::usage::retention::{self, RetentionPolicy};

#[tauri::command]
pub async fn load_settings(
    state: State<'_, AppState>,
) -> Result<AppConfig, AppError> {
    Ok(state.config.read().await.clone())
}

#[tauri::command]
pub async fn save_settings(
    state: State<'_, AppState>,
    settings: AppConfig,
) -> Result<(), AppError> {
    let retention_months = settings.usage_retention_months;
    {
        let mut current = state.config.write().await;
        *current = settings;
    }

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
    _template_id: String,
) -> Result<(), AppError> {
    // Open the template file in the default text editor
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Mercury")
        .join("prompts");
    let path = data_dir.join(format!("{_template_id}.yaml"));
    if path.exists() {
        open::that(path).map_err(|e| {
            AppError::Config(format!("Cannot open template file: {e}"))
        })?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_settings(
    state: State<'_, AppState>,
) -> Result<AppConfig, AppError> {
    Ok(state.config.read().await.clone())
}

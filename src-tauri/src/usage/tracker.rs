use std::sync::Arc;

use crate::db::llm_usage_store::LLMUsageStore;
use crate::db::models::LLMUsageEvent;
use crate::error::AppError;

/// Record an LLM usage event in the database.
pub async fn record_usage_event(
    store: &Arc<dyn LLMUsageStore>,
    task_run_id: Option<i64>,
    provider_name: &str,
    provider_base_url: &str,
    model_name: &str,
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
    request_phase: &str,
    request_status: &str,
    endpoint_url: Option<&str>,
) -> Result<(), AppError> {
    let event = LLMUsageEvent {
        id: 0,
        task_run_id,
        provider_name: provider_name.to_string(),
        provider_base_url: provider_base_url.to_string(),
        model_name: model_name.to_string(),
        prompt_tokens: prompt_tokens as i32,
        completion_tokens: completion_tokens as i32,
        total_tokens: total_tokens as i32,
        request_phase: request_phase.to_string(),
        request_status: request_status.to_string(),
        endpoint_url: endpoint_url.map(|s| s.to_string()),
        created_at: String::new(),
    };
    store.record_event(&event).await
}

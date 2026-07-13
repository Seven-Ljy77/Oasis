use crate::error::AppError;

/// Record an LLM usage event in the database.
pub async fn record_usage_event(
    _task_run_id: Option<i64>,
    _provider_name: &str,
    _provider_base_url: &str,
    _model_name: &str,
    _prompt_tokens: u32,
    _completion_tokens: u32,
    _total_tokens: u32,
    _request_phase: &str,
    _request_status: &str,
    _endpoint_url: Option<&str>,
) -> Result<(), AppError> {
    todo!()
}

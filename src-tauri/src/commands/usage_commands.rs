use std::sync::Arc;
use tauri::State;

use crate::db::llm_usage_store::LLMUsageStore;
use crate::error::AppError;
use crate::state::AppState;
use crate::usage::reports::{self, ReportScope, ReportWindow};

fn store_ref(state: &AppState) -> Arc<dyn LLMUsageStore> {
    state.llm_usage_store.clone() as Arc<dyn LLMUsageStore>
}

#[tauri::command]
pub async fn fetch_provider_report(
    state: State<'_, AppState>,
    window: ReportWindow,
) -> Result<crate::usage::reports::UsageReportSnapshot, AppError> {
    reports::query_report(&store_ref(&state), &ReportScope::All, &window).await
}

#[tauri::command]
pub async fn fetch_model_report(
    state: State<'_, AppState>,
    window: ReportWindow,
) -> Result<crate::usage::reports::UsageReportSnapshot, AppError> {
    reports::query_report(&store_ref(&state), &ReportScope::All, &window).await
}

#[tauri::command]
pub async fn fetch_agent_report(
    state: State<'_, AppState>,
    window: ReportWindow,
) -> Result<crate::usage::reports::UsageReportSnapshot, AppError> {
    reports::query_report(&store_ref(&state), &ReportScope::All, &window).await
}

#[tauri::command]
pub async fn fetch_comparison(
    state: State<'_, AppState>,
    provider_names: Vec<String>,
    window: ReportWindow,
) -> Result<Vec<crate::usage::reports::DailyTokenRecord>, AppError> {
    reports::query_daily_comparison(&store_ref(&state), &provider_names, &window).await
}

#[tauri::command]
pub async fn clear_usage(
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    state.llm_usage_store.clear_all().await
}

#[tauri::command]
pub async fn get_usage_report(
    state: State<'_, AppState>,
    days: Option<i64>,
) -> Result<crate::usage::reports::UsageReportSnapshot, AppError> {
    let window = match days {
        Some(d) => {
            let from = chrono::Local::now().date_naive() - chrono::Duration::days(d);
            ReportWindow::Custom {
                start: from.format("%Y-%m-%d").to_string(),
                end: chrono::Local::now().format("%Y-%m-%d").to_string(),
            }
        }
        None => ReportWindow::Last30Days,
    };
    reports::query_report(&store_ref(&state), &ReportScope::All, &window).await
}

use tauri::State;

use crate::error::AppError;
use crate::state::AppState;
use crate::usage::reports::{ReportWindow, UsageReportSnapshot};

#[tauri::command]
pub async fn fetch_provider_report(
    _state: State<'_, AppState>,
    _window: ReportWindow,
) -> Result<UsageReportSnapshot, AppError> {
    todo!()
}

#[tauri::command]
pub async fn fetch_model_report(
    _state: State<'_, AppState>,
    _window: ReportWindow,
) -> Result<UsageReportSnapshot, AppError> {
    todo!()
}

#[tauri::command]
pub async fn fetch_agent_report(
    _state: State<'_, AppState>,
    _window: ReportWindow,
) -> Result<UsageReportSnapshot, AppError> {
    todo!()
}

#[tauri::command]
pub async fn fetch_comparison(
    _state: State<'_, AppState>,
    _provider_names: Vec<String>,
    _window: ReportWindow,
) -> Result<Vec<crate::usage::reports::DailyTokenRecord>, AppError> {
    todo!()
}

#[tauri::command]
pub async fn clear_usage(
    _state: State<'_, AppState>,
) -> Result<u64, AppError> {
    todo!()
}

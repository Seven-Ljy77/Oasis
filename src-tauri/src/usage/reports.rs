use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Scope for a usage report query.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReportScope {
    All,
    Provider(String),
    Model(String),
    AgentKind(String),
}

/// Time window for a usage report.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReportWindow {
    Today,
    ThisWeek,
    ThisMonth,
    Last30Days,
    Last90Days,
    Custom { start: String, end: String },
    AllTime,
}

/// A snapshot of usage statistics.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageReportSnapshot {
    pub total_requests: u64,
    pub total_prompt_tokens: u64,
    pub total_completion_tokens: u64,
    pub total_tokens: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub by_provider: Vec<ProviderBreakdown>,
    pub by_model: Vec<ModelBreakdown>,
    pub by_agent_kind: Vec<AgentKindBreakdown>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderBreakdown {
    pub provider_name: String,
    pub requests: u64,
    pub tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelBreakdown {
    pub model_name: String,
    pub requests: u64,
    pub tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentKindBreakdown {
    pub agent_kind: String,
    pub requests: u64,
    pub tokens: u64,
}

/// Query a usage report for the given scope and window.
pub fn query_report(_scope: &ReportScope, _window: &ReportWindow) -> Result<UsageReportSnapshot, AppError> {
    todo!()
}

/// Query a comparison report showing daily token usage over a window.
pub fn query_daily_comparison(
    _provider_names: &[String],
    _window: &ReportWindow,
) -> Result<Vec<DailyTokenRecord>, AppError> {
    todo!()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyTokenRecord {
    pub date: String,
    pub provider_name: String,
    pub model_name: String,
    pub prompt_tokens: u64,
    pub completion_tokens: u64,
}

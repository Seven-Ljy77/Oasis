use std::collections::HashMap;
use std::sync::Arc;

use chrono::Datelike;
use serde::{Deserialize, Serialize};

use crate::db::llm_usage_store::LLMUsageStore;
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

/// Convert a ReportWindow to a date range tuple (from_date, to_date).
fn window_to_dates(window: &ReportWindow) -> (Option<String>, Option<String>) {
    let today = chrono::Local::now().date_naive();
    let tomorrow = today + chrono::Duration::days(1);
    match window {
        ReportWindow::Today => {
            let s = today.format("%Y-%m-%d").to_string();
            let e = tomorrow.format("%Y-%m-%d").to_string();
            (Some(s), Some(e))
        }
        ReportWindow::ThisWeek => {
            let weekday = today.weekday().num_days_from_monday() as i64;
            let monday = today - chrono::Duration::days(weekday);
            let s = monday.format("%Y-%m-%d").to_string();
            (Some(s), None)
        }
        ReportWindow::ThisMonth => {
            let first = today.with_day(1).unwrap_or(today);
            (Some(first.format("%Y-%m-%d").to_string()), None)
        }
        ReportWindow::Last30Days => {
            let from = today - chrono::Duration::days(30);
            (Some(from.format("%Y-%m-%d").to_string()), None)
        }
        ReportWindow::Last90Days => {
            let from = today - chrono::Duration::days(90);
            (Some(from.format("%Y-%m-%d").to_string()), None)
        }
        ReportWindow::Custom { start, end } => (Some(start.clone()), Some(end.clone())),
        ReportWindow::AllTime => (None, None),
    }
}

/// Aggregate daily buckets into a snapshot.
fn aggregate_snapshot(buckets: &[crate::db::llm_usage_store::DailyUsageBucket]) -> UsageReportSnapshot {
    let mut total_requests: u64 = 0;
    let mut total_prompt_tokens: u64 = 0;
    let mut total_completion_tokens: u64 = 0;
    let mut total_tokens: u64 = 0;

    let mut provider_map: HashMap<String, (u64, u64)> = HashMap::new();
    let mut model_map: HashMap<String, (u64, u64)> = HashMap::new();

    for b in buckets {
        let reqs = b.request_count as u64;
        let toks = b.total_tokens as u64;
        total_requests += reqs;
        total_prompt_tokens += b.prompt_tokens as u64;
        total_completion_tokens += b.completion_tokens as u64;
        total_tokens += toks;

        let pe = provider_map
            .entry(b.provider_name.clone())
            .or_insert((0, 0));
        pe.0 += reqs;
        pe.1 += toks;

        let me = model_map
            .entry(b.model_name.clone())
            .or_insert((0, 0));
        me.0 += reqs;
        me.1 += toks;
    }

    let by_provider: Vec<ProviderBreakdown> = provider_map
        .into_iter()
        .map(|(name, (requests, tokens))| ProviderBreakdown {
            provider_name: name,
            requests,
            tokens,
        })
        .collect();

    let by_model: Vec<ModelBreakdown> = model_map
        .into_iter()
        .map(|(name, (requests, tokens))| ModelBreakdown {
            model_name: name,
            requests,
            tokens,
        })
        .collect();

    // Agent kind breakdown — not yet available from LLMUsageStore (requires JOIN with agent_task_run).
    // For now, report all as "unknown" until task_run_id linkage is plumbed.
    let by_agent_kind = vec![];

    UsageReportSnapshot {
        total_requests,
        total_prompt_tokens,
        total_completion_tokens,
        total_tokens,
        successful_requests: total_requests,
        failed_requests: 0,
        by_provider,
        by_model,
        by_agent_kind,
    }
}

/// Query a usage report for the given scope and window.
pub async fn query_report(
    store: &Arc<dyn LLMUsageStore>,
    _scope: &ReportScope,
    window: &ReportWindow,
) -> Result<UsageReportSnapshot, AppError> {
    let (from_date, to_date) = window_to_dates(window);
    let buckets = store
        .query_daily_buckets(from_date.as_deref(), to_date.as_deref())
        .await?;
    let mut snapshot = aggregate_snapshot(&buckets);

    // Query failed requests separately from the raw event table
    let failed = count_failed(store, from_date.as_deref(), to_date.as_deref()).await?;
    snapshot.failed_requests = failed;
    snapshot.successful_requests = snapshot.total_requests.saturating_sub(failed);

    Ok(snapshot)
}

/// Count requests with non-success status in the given date range.
async fn count_failed(
    store: &Arc<dyn LLMUsageStore>,
    from_date: Option<&str>,
    to_date: Option<&str>,
) -> Result<u64, AppError> {
    store.count_by_status("failed", from_date, to_date).await
}

/// Query a comparison report showing daily token usage over a window.
pub async fn query_daily_comparison(
    store: &Arc<dyn LLMUsageStore>,
    _provider_names: &[String],
    window: &ReportWindow,
) -> Result<Vec<DailyTokenRecord>, AppError> {
    let (from_date, to_date) = window_to_dates(window);
    let buckets = store
        .query_daily_buckets(from_date.as_deref(), to_date.as_deref())
        .await?;

    let records: Vec<DailyTokenRecord> = buckets
        .into_iter()
        .map(|b| DailyTokenRecord {
            date: b.date,
            provider_name: b.provider_name,
            model_name: b.model_name,
            prompt_tokens: b.prompt_tokens as u64,
            completion_tokens: b.completion_tokens as u64,
        })
        .collect();

    Ok(records)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyTokenRecord {
    pub date: String,
    pub provider_name: String,
    pub model_name: String,
    pub prompt_tokens: u64,
    pub completion_tokens: u64,
}

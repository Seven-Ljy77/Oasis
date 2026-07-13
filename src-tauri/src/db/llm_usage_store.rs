use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::db::models::LLMUsageEvent;
use crate::error::AppError;

/// A daily aggregation bucket for token usage reporting.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyUsageBucket {
    pub date: String,
    pub provider_name: String,
    pub model_name: String,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
    pub total_tokens: i64,
    pub request_count: i64,
}

/// Persistence operations for LLM token usage events.
#[async_trait]
pub trait LLMUsageStore: Send + Sync {
    /// Record a single token usage event.
    async fn record_event(&self, event: &LLMUsageEvent) -> Result<(), AppError>;

    /// Query usage aggregated by day, optionally filtered by date range.
    async fn query_daily_buckets(
        &self,
        from_date: Option<&str>,
        to_date: Option<&str>,
    ) -> Result<Vec<DailyUsageBucket>, AppError>;

    /// Query usage aggregated by date range for comparison (e.g. this month
    /// vs last month).
    async fn query_comparison(
        &self,
        period_a_start: &str,
        period_a_end: &str,
        period_b_start: &str,
        period_b_end: &str,
    ) -> Result<(Vec<DailyUsageBucket>, Vec<DailyUsageBucket>), AppError>;

    /// Remove usage events older than the given date.
    async fn purge_expired(&self, before_date: &str) -> Result<(), AppError>;

    /// Delete all usage events (for testing / reset).
    async fn clear_all(&self) -> Result<(), AppError>;
}

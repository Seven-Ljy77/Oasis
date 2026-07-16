use std::sync::Arc;

use async_trait::async_trait;
use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db::manager::DatabaseManager;
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

// =============================================================================
// SQLite Implementation
// =============================================================================

pub struct SqliteLLMUsageStore {
    db: Arc<DatabaseManager>,
}

impl SqliteLLMUsageStore {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl LLMUsageStore for SqliteLLMUsageStore {
    async fn record_event(&self, event: &LLMUsageEvent) -> Result<(), AppError> {
        let e = event.clone();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "INSERT INTO llm_usage_event \
                     (task_run_id, provider_name, provider_base_url, model_name, \
                      prompt_tokens, completion_tokens, total_tokens, \
                      request_phase, request_status, endpoint_url, created_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, datetime('now'))",
                    params![
                        e.task_run_id,
                        e.provider_name,
                        e.provider_base_url,
                        e.model_name,
                        e.prompt_tokens,
                        e.completion_tokens,
                        e.total_tokens,
                        e.request_phase,
                        e.request_status,
                        e.endpoint_url,
                    ],
                )?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn query_daily_buckets(
        &self,
        from_date: Option<&str>,
        to_date: Option<&str>,
    ) -> Result<Vec<DailyUsageBucket>, AppError> {
        let fd = from_date.map(|s| s.to_string());
        let td = to_date.map(|s| s.to_string());
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT date(created_at) as d, provider_name, model_name, \
                     SUM(prompt_tokens), SUM(completion_tokens), SUM(total_tokens), COUNT(*) \
                     FROM llm_usage_event \
                     WHERE (?1 IS NULL OR created_at >= ?1) \
                       AND (?2 IS NULL OR created_at < ?2) \
                     GROUP BY d, provider_name, model_name \
                     ORDER BY d, provider_name",
                )?;
                let buckets = stmt
                    .query_map(params![fd, td], |row| {
                        Ok(DailyUsageBucket {
                            date: row.get(0)?,
                            provider_name: row.get(1)?,
                            model_name: row.get(2)?,
                            prompt_tokens: row.get(3)?,
                            completion_tokens: row.get(4)?,
                            total_tokens: row.get(5)?,
                            request_count: row.get(6)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(buckets)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn query_comparison(
        &self,
        period_a_start: &str,
        period_a_end: &str,
        period_b_start: &str,
        period_b_end: &str,
    ) -> Result<(Vec<DailyUsageBucket>, Vec<DailyUsageBucket>), AppError> {
        let a_start = period_a_start.to_string();
        let a_end = period_a_end.to_string();
        let b_start = period_b_start.to_string();
        let b_end = period_b_end.to_string();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT date(created_at) as d, provider_name, model_name, \
                     SUM(prompt_tokens), SUM(completion_tokens), SUM(total_tokens), COUNT(*) \
                     FROM llm_usage_event \
                     WHERE (created_at >= ?1 AND created_at < ?2) \
                        OR (created_at >= ?3 AND created_at < ?4) \
                     GROUP BY d, provider_name, model_name \
                     ORDER BY d, provider_name",
                )?;
                let all: Vec<DailyUsageBucket> = stmt
                    .query_map(params![a_start, a_end, b_start, b_end], |row| {
                        Ok(DailyUsageBucket {
                            date: row.get(0)?,
                            provider_name: row.get(1)?,
                            model_name: row.get(2)?,
                            prompt_tokens: row.get(3)?,
                            completion_tokens: row.get(4)?,
                            total_tokens: row.get(5)?,
                            request_count: row.get(6)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                // Split by date range
                let period_a: Vec<_> = all
                    .iter()
                    .filter(|b| b.date.as_str() >= a_start.as_str() && b.date.as_str() < a_end.as_str())
                    .cloned()
                    .collect();
                let period_b: Vec<_> = all
                    .iter()
                    .filter(|b| b.date.as_str() >= b_start.as_str() && b.date.as_str() < b_end.as_str())
                    .cloned()
                    .collect();
                Ok((period_a, period_b))
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn purge_expired(&self, before_date: &str) -> Result<(), AppError> {
        let bd = before_date.to_string();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "DELETE FROM llm_usage_event WHERE created_at < ?1",
                    params![bd],
                )?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn clear_all(&self) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute("DELETE FROM llm_usage_event", [])?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }
}

use std::sync::Arc;

use crate::db::llm_usage_store::LLMUsageStore;
use crate::error::AppError;

/// Retention policy for usage data.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RetentionPolicy {
    /// Keep usage records forever.
    Forever,
    /// Keep usage records for a specified number of months.
    Months(u32),
}

impl Default for RetentionPolicy {
    fn default() -> Self {
        Self::Forever
    }
}

/// Purge usage events that have expired according to the retention policy.
pub async fn purge_expired(
    store: &Arc<dyn LLMUsageStore>,
    policy: &RetentionPolicy,
) -> Result<(), AppError> {
    if let Some(cutoff) = cutoff_date(policy) {
        let cutoff_str = cutoff.format("%Y-%m-%d").to_string();
        store.purge_expired(&cutoff_str).await?;
    }
    Ok(())
}

/// Calculate the cutoff date for the retention policy.
pub fn cutoff_date(policy: &RetentionPolicy) -> Option<chrono::NaiveDate> {
    match policy {
        RetentionPolicy::Forever => None,
        RetentionPolicy::Months(n) => {
            let today = chrono::Local::now().date_naive();
            let cutoff = today - chrono::Duration::days((n * 30) as i64);
            Some(cutoff)
        }
    }
}

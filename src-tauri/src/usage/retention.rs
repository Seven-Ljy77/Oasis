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
pub async fn purge_expired(_policy: &RetentionPolicy) -> Result<usize, AppError> {
    todo!()
}

/// Calculate the cutoff date for the retention policy.
pub fn cutoff_date(_policy: &RetentionPolicy) -> Option<chrono::NaiveDate> {
    todo!()
}

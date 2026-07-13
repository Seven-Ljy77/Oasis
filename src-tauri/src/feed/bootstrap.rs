use crate::error::AppError;

/// Result of the bootstrap process.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BootstrapResult {
    /// Whether this was a first-run bootstrap.
    pub is_first_run: bool,
    /// Number of default feeds added.
    pub default_feeds_added: usize,
    /// Whether an OPML import was offered.
    pub opml_offered: bool,
}

/// Run first-launch bootstrap if the database is empty.
pub async fn bootstrap_if_needed() -> Result<BootstrapResult, AppError> {
    todo!()
}

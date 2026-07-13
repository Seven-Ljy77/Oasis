use crate::error::AppError;

/// Validate and normalize a feed URL.
/// Returns the normalized URL string.
pub fn validate_url(_url: &str) -> Result<String, AppError> {
    todo!()
}

/// Check whether a feed URL already exists in the database.
/// Returns Ok(()) if the URL is unique, Err if it is a duplicate.
pub fn check_duplicate(_url: &str) -> Result<(), AppError> {
    todo!()
}

/// Probe a URL to confirm it serves a valid feed.
pub fn probe_feed_url(_url: &str) -> Result<FeedProbeResult, AppError> {
    todo!()
}

#[derive(Debug, Clone)]
pub struct FeedProbeResult {
    pub final_url: String,
    pub content_type: Option<String>,
    pub feed_type: Option<FeedType>,
}

#[derive(Debug, Clone)]
pub enum FeedType {
    Rss,
    Atom,
    JsonFeed,
    Unknown,
}

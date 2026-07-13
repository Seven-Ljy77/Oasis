use crate::db::feed_store::FeedStore;
use crate::error::AppError;

/// Validate and normalize a feed URL.
/// Returns the normalized URL string.
pub fn validate_url(url: &str) -> Result<String, AppError> {
    let parsed = url::Url::parse(url).map_err(|e| {
        AppError::InvalidInput(format!("Invalid URL '{}': {}", url, e))
    })?;

    // Enforce HTTPS.
    if parsed.scheme() != "https" {
        return Err(AppError::InvalidInput(
            "Only HTTPS URLs are supported for feed subscriptions".to_string(),
        ));
    }

    // Normalize: strip trailing slash, lowercase scheme/host, strip fragment.
    let mut normalized = parsed.clone();
    normalized.set_fragment(None);
    // Strip trailing slash from path for consistency
    let trimmed_path = normalized.path().trim_end_matches('/').to_string();
    if normalized.path().ends_with('/') && normalized.path().len() > 1 {
        normalized.set_path(&trimmed_path);
    }

    Ok(normalized.to_string())
}

/// Check whether a feed URL already exists in the database.
/// Returns Ok(()) if the URL is unique, Err if it is a duplicate.
pub async fn check_duplicate(
    url: &str,
    feed_store: &dyn FeedStore,
) -> Result<(), AppError> {
    let existing = feed_store.find_by_url(url).await?;
    if existing.is_some() {
        return Err(AppError::InvalidInput(format!(
            "A feed with URL '{}' already exists",
            url
        )));
    }
    Ok(())
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

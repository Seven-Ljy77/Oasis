use crate::error::AppError;

/// Resolve the title for a feed based on explicit input, feed content, and site URL.
/// Priority: explicit > parsed feed title > site URL derived.
pub fn resolve_title(
    explicit: Option<&str>,
    feed_title: Option<&str>,
    site_url: Option<&str>,
) -> Result<String, AppError> {
    // 1. Explicit user-provided title wins.
    if let Some(title) = explicit {
        if !title.trim().is_empty() {
            return Ok(title.trim().to_string());
        }
    }

    // 2. Fall back to the title parsed from the feed.
    if let Some(title) = feed_title {
        if !title.trim().is_empty() {
            return Ok(title.trim().to_string());
        }
    }

    // 3. Fall back to hostname extracted from site_url.
    if let Some(url) = site_url {
        if let Ok(parsed) = url::Url::parse(url) {
            if let Some(host) = parsed.host_str() {
                let hostname = host.trim_start_matches("www.");
                if !hostname.is_empty() {
                    return Ok(hostname.to_string());
                }
            }
        }
    }

    // 4. Last resort.
    Ok("Untitled Feed".to_string())
}

/// Fetch and extract a title from a site's HTML <title> tag.
pub fn fetch_site_title(_url: &str) -> Result<Option<String>, AppError> {
    todo!()
}

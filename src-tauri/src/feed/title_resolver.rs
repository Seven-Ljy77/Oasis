use crate::error::AppError;

/// Resolve the title for a feed based on explicit input, feed content, and site URL.
/// Priority: explicit > parsed feed title > site URL derived.
pub fn resolve_title(
    _explicit: Option<&str>,
    _feed_title: Option<&str>,
    _site_url: Option<&str>,
) -> Result<String, AppError> {
    todo!()
}

/// Fetch and extract a title from a site's HTML <title> tag.
pub fn fetch_site_title(_url: &str) -> Result<Option<String>, AppError> {
    todo!()
}

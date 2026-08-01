use std::sync::LazyLock;

use crate::error::AppError;

static TITLE_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (compatible; Oasis/0.1; +https://github.com/neolee/mercury)")
        .build()
        .expect("Failed to create title resolver HTTP client")
});

/// Resolve the title for a feed based on explicit input, feed content, and site URL.
/// Priority: explicit > parsed feed title > site HTML title > site URL hostname.
pub fn resolve_title(
    explicit: Option<&str>,
    feed_title: Option<&str>,
    site_url: Option<&str>,
) -> Result<String, AppError> {
    resolve_title_with_site(explicit, feed_title, site_url, None)
}

/// Same as `resolve_title` but accepts a pre-fetched site title (from `<title>` or og:site_name).
pub fn resolve_title_with_site(
    explicit: Option<&str>,
    feed_title: Option<&str>,
    site_url: Option<&str>,
    site_title: Option<&str>,
) -> Result<String, AppError> {
    // 1. Explicit user-provided title wins.
    if let Some(title) = explicit {
        if !title.trim().is_empty() {
            return Ok(title.trim().to_string());
        }
    }

    // 2. Fall back to the title parsed from the feed XML.
    if let Some(title) = feed_title {
        if !title.trim().is_empty() {
            return Ok(title.trim().to_string());
        }
    }

    // 3. Fall back to the site HTML <title> or og:site_name.
    if let Some(title) = site_title {
        if !title.trim().is_empty() {
            // Strip common site-name suffixes.
            let cleaned = title
                .split(" — ").next()
                .unwrap_or(title)
                .split(" | ").next()
                .unwrap_or(title)
                .split(" - ").next()
                .unwrap_or(title)
                .trim();
            if !cleaned.is_empty() {
                return Ok(cleaned.to_string());
            }
        }
    }

    // 4. Fall back to hostname extracted from site_url.
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

    // 5. Last resort.
    Ok("Untitled Feed".to_string())
}

/// Fetch the HTML of a site and extract the title from `<title>` and
/// `<meta property="og:site_name">` tags.
pub async fn fetch_site_title(url: &str) -> Result<Option<String>, AppError> {
    let response = match TITLE_CLIENT.get(url).send().await {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };

    if !response.status().is_success() {
        return Ok(None);
    }

    let html = match response.text().await {
        Ok(t) => t,
        Err(_) => return Ok(None),
    };

    // Extract <title> tag content.
    if let Some(title) = extract_tag_content(&html, "title") {
        if !title.trim().is_empty() {
            return Ok(Some(title.trim().to_string()));
        }
    }

    // Fall back to <meta property="og:site_name">.
    if let Some(site_name) = extract_meta_content(&html, "property", "og:site_name") {
        if !site_name.trim().is_empty() {
            return Ok(Some(site_name.trim().to_string()));
        }
    }

    Ok(None)
}

/// Simple HTML tag content extractor — finds the first `<tag>content</tag>`.
fn extract_tag_content(html: &str, tag: &str) -> Option<String> {
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);

    let start = html.find(&open)?;
    // Advance past the opening tag to find `>`.
    let content_start = html[start..].find('>')? + start + 1;
    let end = html[content_start..].find(&close)? + content_start;

    Some(html[content_start..end].to_string())
}

/// Extract content from a `<meta>` tag attribute.
fn extract_meta_content(html: &str, attr: &str, value: &str) -> Option<String> {
    let lower = html.to_lowercase();
    let pattern = format!("{}=\"{}\"", attr, value);
    let pos = lower.find(&pattern)?;

    // Find the content="..." on the same meta tag.
    let after = &html[pos..];
    let content_pos = after.find("content=\"")?;
    let content_start = pos + content_pos + 9; // skip `content="`
    let content_end = after[content_pos + 9..].find('"')? + content_start;

    Some(html[content_start..content_end].to_string())
}

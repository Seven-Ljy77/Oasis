// =============================================================================
// Mercury — Article HTML Fetcher
//
// Fetches the raw HTML of an article URL for the reader pipeline. In the
// full macOS pipeline this step is followed by a Readability.js clean-up
// pass executed inside a WebView; here we return the source HTML directly.
// =============================================================================

use std::sync::LazyLock;
use crate::error::AppError;

/// Shared HTTP client with connection pooling, reused across all requests.
static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        )
        .timeout(std::time::Duration::from_secs(30))
        .pool_idle_timeout(std::time::Duration::from_secs(90))
        .build()
        .expect("Failed to create HTTP client")
});

/// Fetch the HTML source of an article by URL.
///
/// Uses a shared client with connection pooling to avoid repeated TLS
/// handshakes. The browser-like User-Agent helps avoid being blocked.
pub async fn fetch_article_html(url: &str) -> Result<String, AppError> {
    let response = CLIENT
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Network(format!("Failed to fetch article: {}", e)))?;

    if !response.status().is_success() {
        return Err(AppError::Network(format!(
            "Article fetch returned HTTP {}",
            response.status()
        )));
    }

    let html = response
        .text()
        .await
        .map_err(|e| AppError::Network(format!("Failed to read response body: {}", e)))?;

    Ok(html)
}

// =============================================================================
// Mercury — Article HTML Fetcher & Content Extractor
//
// Fetches raw HTML from article URLs and extracts the main content using
// Mozilla's Readability.js (embedded via the readability-js crate which
// bundles QuickJS + linkedom + the actual Readability.js source).
// =============================================================================

use std::sync::LazyLock;

use readability_js::Readability;

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

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/// Fetch the HTML source of an article by URL.
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

// ---------------------------------------------------------------------------
// Content extraction (Mozilla Readability.js via QuickJS)
// ---------------------------------------------------------------------------

/// Result of article content extraction.
#[derive(Debug, Clone)]
pub struct CleanedArticle {
    /// Cleaned HTML containing only the main article content.
    pub content_html: String,
    /// Title extracted by Readability (may differ from feed title).
    pub title: Option<String>,
    /// Author / byline extracted from the page.
    pub byline: Option<String>,
    /// Plain-text version of the article content (for AI input).
    pub text_content: String,
}

/// Version constant — bump this when the extraction algorithm changes.
pub const READABILITY_VERSION: i32 = 1;

/// Extract the main article content from raw HTML using Mozilla Readability.js.
///
/// Creates a fresh Readability instance per call because the underlying
/// QuickJS engine is not `Send`/`Sync`. The ~30ms init cost is acceptable
/// for article extraction (which already involves network latency).
pub fn extract_article_content(raw_html: &str) -> Result<CleanedArticle, AppError> {
    let readability = Readability::new()
        .map_err(|e| AppError::Reader(format!("Failed to init Readability.js: {}", e)))?;

    let article = readability
        .parse(raw_html)
        .map_err(|e| AppError::Reader(format!("Readability extraction failed: {}", e)))?;

    Ok(CleanedArticle {
        content_html: article.content,
        title: Some(article.title).filter(|t| !t.is_empty()),
        byline: article.byline,
        text_content: article.text_content,
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: fetch a URL and extract article content, printing stats.
    async fn test_url(url: &str, label: &str) {
        println!("\n========== {} ==========", label);
        println!("URL: {}", url);

        match fetch_article_html(url).await {
            Ok(raw_html) => {
                let raw_len = raw_html.len();
                let raw_text_len = raw_html
                    .chars()
                    .filter(|c| !c.is_ascii_whitespace() || *c == ' ')
                    .count();

                println!("Raw HTML size: {} bytes", raw_len);

                match extract_article_content(&raw_html) {
                    Ok(cleaned) => {
                        let content_len = cleaned.content_html.len();
                        let text_len = cleaned.text_content.len();
                        let reduction = if raw_len > 0 {
                            100.0 * (1.0 - content_len as f64 / raw_len as f64)
                        } else {
                            0.0
                        };

                        println!("Title:    {:?}", cleaned.title);
                        println!("Byline:   {:?}", cleaned.byline);
                        println!("Cleaned:  {} bytes (reduction: {:.0}%)", content_len, reduction);
                        println!("Text:     {} chars", text_len);
                        println!("First 300 chars of text:");
                        println!("  {}", &cleaned.text_content.chars().take(300).collect::<String>());
                        println!("PASS");
                    }
                    Err(e) => println!("Extraction failed: {:?}", e),
                }
            }
            Err(e) => println!("Fetch failed: {:?}", e),
        }
    }

    /// Test Readability on a realistic blog-post HTML snippet (no network).
    #[test]
    fn test_readability_sample_html() {
        let html = r#"<html><head><title>Test Article</title></head><body>
            <nav>Nav bar with links</nav>
            <article>
                <h1>Hello World</h1>
                <p>This is the main content of the article. It contains multiple paragraphs.</p>
                <p>Second paragraph with some <strong>bold</strong> text and <a href="http://example.com">a link</a>.</p>
                <p>Third paragraph.</p>
            </article>
            <aside>Sidebar content</aside>
            <footer>Copyright 2025</footer>
        </body></html>"#;

        let result = extract_article_content(html).expect("Extraction should succeed");
        assert!(result.content_html.contains("Hello World"));
        assert!(result.content_html.contains("main content"));
        assert!(result.content_html.contains("Second paragraph"));
        // Should NOT contain nav/footer content
        assert!(!result.content_html.contains("Nav bar"));
        assert!(!result.content_html.contains("Copyright"));
        assert!(result.title == Some("Test Article".to_string()));
        assert!(result.text_content.len() > 50);
    }

    /// Test Readability on a messy real-world page with ads, nav, and sidebars.
    #[test]
    fn test_readability_messy_page() {
        // Simulates a typical news/blog page with navigation, ads, sidebar,
        // and the actual article content buried inside div structures.
        let html = r##"<!DOCTYPE html>
<html lang="en"><head>
<title>How to Build a Raft Consensus Algorithm in Rust — Tech Blog</title>
<meta name="author" content="Jane Doe">
</head><body>
<header class="site-header">
    <div class="logo">Tech Blog</div>
    <nav class="main-nav">
        <ul><li><a href="/">Home</a></li><li><a href="/about">About</a></li></ul>
    </nav>
</header>
<div class="ad-banner" style="background:#eee;padding:10px;text-align:center;">
    SPONSORED: Buy our cloud services now! Click here for 50% off!
</div>
<div class="page-wrapper">
    <main class="content">
        <article class="post">
            <h1 class="title">How to Build a Raft Consensus Algorithm in Rust</h1>
            <div class="meta">By Jane Doe · Published March 15, 2025 · 12 min read</div>
            <div class="post-body">
                <p>Implementing the Raft consensus algorithm is a rite of passage for distributed systems engineers. In this tutorial, we will walk through building a production-ready Raft implementation in Rust, covering leader election, log replication, and safety guarantees.</p>
                <h2>What is Raft?</h2>
                <p>Raft is a consensus algorithm designed to be understandable. Unlike Paxos, which is notoriously difficult to grasp, Raft separates the consensus problem into three relatively independent sub-problems: leader election, log replication, and safety.</p>
                <p>The key insight of Raft is that it uses a <strong>strong leader</strong> approach. All log entries flow from the leader to the followers, and the leader decides when it is safe to apply log entries to the state machine.</p>
                <h2>Setting Up the Project</h2>
                <p>Let's start by creating a new Rust project and adding the necessary dependencies. We'll need <code>tokio</code> for async networking and <code>serde</code> for message serialization.</p>
                <pre><code>cargo new raft-rs
cd raft-rs
cargo add tokio serde serde_json</code></pre>
                <p>The core data structures of our Raft node include the persisted state (current term, voted for) and volatile state (commit index, last applied).</p>
                <h2>Leader Election</h2>
                <p>Leader election is the heartbeat of Raft. When a node starts, it begins as a follower. If a follower does not hear from a leader within a randomized election timeout, it transitions to candidate, increments its term, and requests votes from all other nodes.</p>
                <p>One important subtlety: a candidate must receive votes from a <em>majority</em> of the cluster to become leader. This means in a 5-node cluster, a candidate needs at least 3 votes.</p>
                <h2>Conclusion</h2>
                <p>Building a Raft implementation from scratch is challenging but deeply rewarding. The algorithm's design — with its clean separation of concerns — makes it an excellent case study in distributed systems engineering.</p>
            </div>
        </article>
    </main>
    <aside class="sidebar">
        <div class="widget"><h3>Popular Posts</h3><ul><li><a href="#">Post 1</a></li><li><a href="#">Post 2</a></li></ul></div>
        <div class="widget"><h3>Categories</h3><ul><li><a href="#">Rust</a></li><li><a href="#">Go</a></li></ul></div>
    </aside>
</div>
<footer class="site-footer"><p>&copy; 2025 Tech Blog. All rights reserved.</p></footer>
</body></html>"##;

        let result = extract_article_content(html).expect("Extraction should succeed");

        // Core content assertions
        assert!(result.content_html.contains("Raft consensus algorithm"));
        assert!(result.content_html.contains("leader election"));
        assert!(result.content_html.contains("log replication"));
        assert!(result.content_html.contains("cargo new raft-rs"));

        // Title extraction
        assert_eq!(
            result.title,
            Some("How to Build a Raft Consensus Algorithm in Rust — Tech Blog".to_string())
        );

        // Byline extraction
        assert_eq!(result.byline, Some("Jane Doe".to_string()));

        // These should be stripped by Readability
        assert!(!result.content_html.contains("SPONSORED"));
        assert!(!result.content_html.contains("Buy our cloud services"));
        assert!(!result.content_html.contains("Popular Posts"));
        assert!(!result.content_html.contains("Categories"));
        assert!(!result.content_html.contains("All rights reserved"));
        assert!(!result.content_html.contains("site-footer"));

        // Text content should be substantial
        assert!(result.text_content.len() > 500);
        assert!(result.text_content.contains("rite of passage"));

        println!("\n===== Readability Test Results =====");
        println!("Title: {:?}", result.title);
        println!("Byline: {:?}", result.byline);
        println!("Cleaned HTML size: {} bytes", result.content_html.len());
        println!("Text content size: {} chars", result.text_content.len());
        println!(
            "Text preview: {}...",
            &result.text_content.chars().take(200).collect::<String>()
        );
    }

    /// Test Readability on a real blog-post HTML fetched from the network.
    /// Only run with `--ignored` since it requires network access.
    #[tokio::test]
    #[ignore]
    async fn test_readability_live_article() {
        test_url(
            "https://en.wikipedia.org/wiki/Rust_(programming_language)",
            "Wikipedia — Rust",
        )
        .await;
    }
}

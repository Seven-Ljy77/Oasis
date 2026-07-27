use std::sync::Arc;

use crate::db::entry_store::{EntryStore, EntryUpsertData, SqliteEntryStore};
use crate::db::feed_store::{FeedStore, SqliteFeedStore};
use crate::db::models::Feed;
use crate::error::AppError;
use crate::feed::feed_parser::parse_feed;
use crate::feed::opml_import::OpmlImporter;
use crate::feed::title_resolver::resolve_title_with_site;

/// Result of the bootstrap process.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BootstrapResult {
    /// Whether this was a first-run bootstrap.
    pub is_first_run: bool,
    /// Number of default feeds added.
    pub default_feeds_added: usize,
}

/// Run first-launch bootstrap if the database is empty.
///
/// Reads a built-in sample OPML file (Hacker News popular feeds) and imports
/// it so new users see content immediately instead of a blank slate.
pub async fn bootstrap_if_needed(
    feed_store: Arc<SqliteFeedStore>,
    entry_store: Arc<SqliteEntryStore>,
) -> Result<BootstrapResult, AppError> {
    // Cast to trait objects for method access.
    let feed_trait: &dyn FeedStore = feed_store.as_ref();
    let entry_trait: &dyn EntryStore = entry_store.as_ref();

    // Check whether this is a first run (no feeds yet).
    let existing = feed_trait.load_all().await?;
    if !existing.is_empty() {
        return Ok(BootstrapResult {
            is_first_run: false,
            default_feeds_added: 0,
        });
    }

    // Parse the embedded sample OPML.
    let opml_xml = include_str!("../../resources/hn-popular.opml");
    let outlines = OpmlImporter::parse_xml(opml_xml)?;

    // Import each feed sequentially with a shared HTTP client.
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Oasis/0.1 (RSS Reader)")
        .build()
        .map_err(|e| AppError::Network(e.to_string()))?;

    let mut added = 0usize;

    for outline in &outlines {
        let feed_url = match url::Url::parse(&outline.xml_url) {
            Ok(u) => u.to_string(),
            Err(_) => continue,
        };

        // Fetch and parse the feed.
        let response = match client.get(&feed_url).send().await {
            Ok(r) => r,
            Err(_) => continue,
        };
        if !response.status().is_success() {
            continue;
        }
        let xml = match response.text().await {
            Ok(t) => t,
            Err(_) => continue,
        };
        let parsed = match parse_feed(&xml) {
            Ok(p) => p,
            Err(_) => continue,
        };

        // Resolve title. Skip the OPML outline title for bootstrap — it often
        // contains raw URLs / hostnames rather than human-readable names. Use the
        // parsed feed title instead (same behaviour as "force site name" import).
        let resolved_title = resolve_title_with_site(
            None, // skip OPML title, use feed XML title
            parsed.title.as_deref(),
            parsed.site_url.as_deref(),
            None, // bootstrap doesn't fetch site title (keeps it fast)
        )
        .unwrap_or_else(|_| parsed.title.clone().unwrap_or_else(|| outline.title.clone()));

        let now = chrono::Utc::now().to_rfc3339();

        // Upsert the feed.
        let feed = feed_trait
            .upsert(Feed {
                id: 0,
                title: resolved_title,
                feed_url: feed_url.clone(),
                site_url: parsed.site_url,
                feed_parser_version: Some(1),
                last_fetched_at: Some(now),
                created_at: chrono::Utc::now().to_rfc3339(),
            })
            .await?;

        // Upsert entries.
        let entry_data: Vec<EntryUpsertData> = parsed
            .entries
            .iter()
            .map(|e| EntryUpsertData {
                guid: e.guid.clone(),
                url: e.url.clone(),
                title: e.title.clone(),
                author: e.author.clone(),
                published_at: e.published_at.clone(),
                summary: e.summary.clone(),
            })
            .collect();

        if !entry_data.is_empty() {
            let _ = entry_trait.upsert_entries(feed.id, &entry_data).await;
        }

        added += 1;
    }

    Ok(BootstrapResult {
        is_first_run: true,
        default_feeds_added: added,
    })
}

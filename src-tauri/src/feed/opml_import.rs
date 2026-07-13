use quick_xml::events::Event;
use quick_xml::Reader;

use crate::db::entry_store::{EntryStore, EntryUpsertData, SqliteEntryStore};
use crate::db::feed_store::{FeedStore, SqliteFeedStore};
use crate::db::models::Feed;
use crate::error::AppError;
use crate::feed::feed_parser::parse_feed;
use crate::feed::title_resolver::resolve_title;

/// Represents a single RSS feed outline entry in an OPML file.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpmlOutline {
    pub title: String,
    pub xml_url: String,
    pub html_url: Option<String>,
}

/// Parses and imports feeds from an OPML 2.0 file.
pub struct OpmlImporter;

impl OpmlImporter {
    /// Parse an OPML file and return the list of feed outlines with `type="rss"`.
    pub fn import(path: &str) -> Result<Vec<OpmlOutline>, AppError> {
        let xml = std::fs::read_to_string(path)
            .map_err(|e| AppError::Unknown(format!("Failed to read OPML file: {}", e)))?;

        let mut reader = Reader::from_str(&xml);

        let mut outlines = Vec::new();
        let mut buf = Vec::new();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Empty(ref e)) | Ok(Event::Start(ref e)) => {
                    if e.name().as_ref() == b"outline" {
                        let mut title = String::new();
                        let mut xml_url = String::new();
                        let mut html_url: Option<String> = None;
                        let mut is_rss = false;

                        for attr_result in e.attributes() {
                            let attr = attr_result.map_err(|e| {
                                AppError::Feed(format!("OPML attribute error: {}", e))
                            })?;
                            match attr.key.as_ref() {
                                b"type" => {
                                    if attr.value.as_ref() == b"rss" {
                                        is_rss = true;
                                    }
                                }
                                b"text" | b"title" => {
                                    if title.is_empty() {
                                        title = quick_xml::escape::unescape(
                                            std::str::from_utf8(&attr.value).unwrap_or(""),
                                        )
                                        .unwrap_or_default()
                                        .to_string();
                                    }
                                }
                                b"xmlUrl" => {
                                    xml_url = quick_xml::escape::unescape(
                                        std::str::from_utf8(&attr.value).unwrap_or(""),
                                    )
                                    .unwrap_or_default()
                                    .to_string();
                                }
                                b"htmlUrl" => {
                                    html_url = Some(
                                        quick_xml::escape::unescape(
                                            std::str::from_utf8(&attr.value).unwrap_or(""),
                                        )
                                        .unwrap_or_default()
                                        .to_string(),
                                    );
                                }
                                _ => {}
                            }
                        }

                        if is_rss && !xml_url.is_empty() {
                            // Fall back to xml_url if no title was set.
                            if title.is_empty() {
                                title = xml_url.clone();
                            }
                            outlines.push(OpmlOutline {
                                title,
                                xml_url,
                                html_url,
                            });
                        }
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => {
                    return Err(AppError::Feed(format!(
                        "Failed to parse OPML XML: {}",
                        e
                    )));
                }
                _ => {}
            }
            buf.clear();
        }

        Ok(outlines)
    }

    /// Import parsed outlines into the database.
    ///
    /// If `replace` is `true`, all existing feeds (and their entries) are deleted first.
    /// Per-outline errors are collected and reported without stopping the import.
    pub async fn import_into_db(
        outlines: &[OpmlOutline],
        replace: bool,
        force_site_name: bool,
        feed_store: &SqliteFeedStore,
        entry_store: &SqliteEntryStore,
    ) -> Result<ImportResult, AppError> {
        let mut result = ImportResult {
            added: 0,
            skipped: 0,
            errors: Vec::new(),
        };

        // If replacing, delete all existing feeds first (cascades to entries).
        if replace {
            let existing = feed_store.load_all().await?;
            for feed in existing {
                feed_store.delete(feed.id).await?;
            }
        }

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .user_agent("Mercury/0.1 (RSS Reader)")
            .build()
            .map_err(|e| AppError::Network(e.to_string()))?;

        for outline in outlines {
            // Lenient URL parse — no HTTPS enforcement for OPML import.
            let feed_url = match url::Url::parse(&outline.xml_url) {
                Ok(u) => u.to_string(),
                Err(e) => {
                    result
                        .errors
                        .push(format!("Invalid feed URL '{}': {}", outline.xml_url, e));
                    continue;
                }
            };

            // Check for duplicates (skip if already subscribed).
            if !replace {
                match feed_store.find_by_url(&feed_url).await {
                    Ok(Some(_)) => {
                        result.skipped += 1;
                        continue;
                    }
                    Err(e) => {
                        result.errors.push(format!(
                            "{}: database error during duplicate check: {}",
                            outline.title, e
                        ));
                        continue;
                    }
                    _ => {}
                }
            }

            // Fetch, parse, and persist the feed.
            match Self::fetch_and_upsert_one(
                &client,
                &feed_url,
                outline,
                force_site_name,
                feed_store,
                entry_store,
            )
            .await
            {
                Ok(()) => result.added += 1,
                Err(e) => {
                    result
                        .errors
                        .push(format!("{}: {}", outline.title, e));
                }
            }
        }

        Ok(result)
    }

    /// Fetch a single feed URL, parse it, and upsert the feed and its entries.
    async fn fetch_and_upsert_one(
        client: &reqwest::Client,
        feed_url: &str,
        outline: &OpmlOutline,
        force_site_name: bool,
        feed_store: &SqliteFeedStore,
        entry_store: &SqliteEntryStore,
    ) -> Result<(), AppError> {
        let response = client
            .get(feed_url)
            .send()
            .await
            .map_err(|e| AppError::Network(format!("Failed to fetch feed: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Network(format!(
                "Feed server returned HTTP {}",
                response.status()
            )));
        }

        let xml = response
            .text()
            .await
            .map_err(|e| AppError::Network(format!("Failed to read response: {}", e)))?;

        let parsed = parse_feed(&xml)?;

        // Reject responses that don't look like a valid feed.
        if parsed.entries.is_empty() && parsed.title.is_none() {
            return Err(AppError::Feed(
                "The URL does not appear to be a valid RSS/Atom/JSON Feed".into(),
            ));
        }

        // Resolve the feed title.
        let resolved_title = if force_site_name {
            // "Force site name": ignore the OPML outline title, use the feed's
            // own title (from the XML) or fall back to the site hostname.
            resolve_title(
                None, // skip OPML title — let the feed speak for itself
                parsed.title.as_deref(),
                parsed.site_url.as_deref(),
            )?
        } else {
            resolve_title(
                Some(&outline.title),
                parsed.title.as_deref(),
                parsed.site_url.as_deref(),
            )?
        };

        let now = chrono::Utc::now().to_rfc3339();

        // Upsert the feed.
        let feed = feed_store
            .upsert(Feed {
                id: 0,
                title: resolved_title,
                feed_url: feed_url.to_string(),
                site_url: parsed.site_url,
                feed_parser_version: Some(1),
                last_fetched_at: Some(now),
                created_at: chrono::Utc::now().to_rfc3339(),
            })
            .await?;

        // Upsert the parsed entries.
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

        entry_store
            .upsert_entries(feed.id, &entry_data)
            .await?;

        Ok(())
    }
}

/// Result of an OPML import operation.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImportResult {
    pub added: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

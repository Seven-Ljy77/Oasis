use quick_xml::events::Event;
use quick_xml::Reader;
use tauri::Emitter;

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
        Self::parse_xml(&xml)
    }

    /// Parse an OPML XML string and return the list of feed outlines.
    pub fn parse_xml(xml: &str) -> Result<Vec<OpmlOutline>, AppError> {
        let mut reader = Reader::from_str(xml);

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

    /// Import parsed outlines into the database with concurrent fetching
    /// and per-feed progress events emitted to the frontend.
    ///
    /// If `replace` is `true`, all existing feeds (and their entries) are
    /// deleted first. Per-outline errors are collected without stopping the
    /// overall import. Progress events are emitted via `app_handle` as
    /// `import-opml-progress` with the following JSON payload:
    ///
    /// ```json
    /// { "feed_title": "...", "feed_url": "...", "status": "fetching|done|error|skipped",
    ///   "completed": 3, "total": 10, "error": "..." }
    /// ```
    pub async fn import_into_db(
        outlines: &[OpmlOutline],
        replace: bool,
        force_site_name: bool,
        concurrency: u32,
        feed_store: std::sync::Arc<SqliteFeedStore>,
        entry_store: std::sync::Arc<SqliteEntryStore>,
        app_handle: tauri::AppHandle,
    ) -> Result<ImportResult, AppError> {
        let total = outlines.len();
        let completed = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let added = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let skipped = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));

        // If replacing, delete all existing feeds first (cascades to entries).
        if replace {
            let existing = feed_store.load_all().await?;
            for feed in existing {
                feed_store.delete(feed.id).await?;
            }
        }

        // Shared HTTP client for all concurrent fetches.
        let client = std::sync::Arc::new(
            reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .user_agent("Mercury/0.1 (RSS Reader)")
                .build()
                .map_err(|e| AppError::Network(e.to_string()))?,
        );

        let concurrency = concurrency.max(1) as usize;
        let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(concurrency));
        let mut join_set = tokio::task::JoinSet::new();
        let mut errors: Vec<String> = Vec::new();

        for outline in outlines {
            let permit = semaphore
                .clone()
                .acquire_owned()
                .await
                .map_err(|e| AppError::Unknown(format!("Semaphore error: {}", e)))?;

            let client = client.clone();
            let feed_store = feed_store.clone();
            let entry_store = entry_store.clone();
            let completed = completed.clone();
            let added = added.clone();
            let skipped = skipped.clone();
            let outline = outline.clone();
            let replace = replace;
            let force_site_name = force_site_name;
            let total_feeds = total;
            let handle = app_handle.clone();

            // Emit "fetching" progress event before spawning.
            let _ = handle.emit(
                "import-opml-progress",
                serde_json::json!({
                    "feed_title": outline.title,
                    "feed_url": outline.xml_url,
                    "status": "fetching",
                    "completed": completed.load(std::sync::atomic::Ordering::SeqCst),
                    "total": total_feeds,
                }),
            );

            join_set.spawn(async move {
                let _permit = permit;

                // URL validation
                let feed_url = match url::Url::parse(&outline.xml_url) {
                    Ok(u) => u.to_string(),
                    Err(e) => {
                        let _ = handle.emit("import-opml-progress", serde_json::json!({
                            "feed_title": outline.title,
                            "feed_url": outline.xml_url,
                            "status": "error",
                            "completed": completed.load(std::sync::atomic::Ordering::SeqCst),
                            "total": total_feeds,
                            "error": format!("Invalid feed URL: {}", e),
                        }));
                        completed.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                        return (outline.title.clone(), Err(format!("Invalid feed URL '{}': {}", outline.xml_url, e)));
                    }
                };

                // Duplicate check
                if !replace {
                    match feed_store.find_by_url(&feed_url).await {
                        Ok(Some(_)) => {
                            skipped.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                            let _ = handle.emit("import-opml-progress", serde_json::json!({
                                "feed_title": outline.title,
                                "feed_url": outline.xml_url,
                                "status": "skipped",
                                "completed": completed.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1,
                                "total": total_feeds,
                            }));
                            return (outline.title.clone(), Ok(()));
                        }
                        Err(e) => {
                            completed.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                            return (outline.title.clone(), Err(format!("Database error: {}", e)));
                        }
                        _ => {}
                    }
                }

                // Fetch, parse, persist
                match fetch_and_upsert_one(
                    &client, &feed_url, &outline, force_site_name,
                    &feed_store, &entry_store,
                ).await {
                    Ok(()) => {
                        added.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                        let _ = handle.emit("import-opml-progress", serde_json::json!({
                            "feed_title": outline.title,
                            "feed_url": outline.xml_url,
                            "status": "done",
                            "completed": completed.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1,
                            "total": total_feeds,
                        }));
                        (outline.title.clone(), Ok(()))
                    }
                    Err(e) => {
                        let _ = handle.emit("import-opml-progress", serde_json::json!({
                            "feed_title": outline.title,
                            "feed_url": outline.xml_url,
                            "status": "error",
                            "completed": completed.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1,
                            "total": total_feeds,
                            "error": e.to_string(),
                        }));
                        (outline.title.clone(), Err(format!("{}: {}", outline.title, e)))
                    }
                }
            });
        }

        // Collect results from all tasks.
        while let Some(result) = join_set.join_next().await {
            match result {
                Ok((title, Ok(()))) => {}
                Ok((_title, Err(err_msg))) => {
                    errors.push(err_msg);
                }
                Err(join_err) => {
                    errors.push(format!("Task panicked: {}", join_err));
                }
            }
        }

        Ok(ImportResult {
            added: added.load(std::sync::atomic::Ordering::SeqCst),
            skipped: skipped.load(std::sync::atomic::Ordering::SeqCst),
            errors,
        })
    }
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

/// Result of an OPML import operation.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImportResult {
    pub added: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

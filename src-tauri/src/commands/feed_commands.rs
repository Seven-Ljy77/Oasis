use tauri::{Emitter, State};

use crate::db::entry_store::{EntryStore, EntryUpsertData};
use crate::db::feed_store::FeedStore;
use crate::db::models::Feed;
use crate::error::AppError;
use crate::feed::feed_parser::parse_feed;
use crate::feed::feed_validator::{check_duplicate, validate_url};
use crate::feed::opml_export::OpmlExporter;
use crate::feed::opml_import::{ImportResult, OpmlImporter};
use crate::feed::title_resolver::resolve_title;
use crate::state::AppState;

#[tauri::command]
pub async fn add_feed(
    state: State<'_, AppState>,
    url: String,
    title: Option<String>,
) -> Result<Feed, AppError> {
    // 1. Validate and normalize the URL.
    let normalized_url = validate_url(&url)?;

    // 2. Check for duplicates.
    check_duplicate(&normalized_url, state.feed_store.as_ref()).await?;

    // 3. Fetch the feed XML.
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Mercury/0.1 (RSS Reader)")
        .build()
        .map_err(|e| AppError::Network(e.to_string()))?;

    let response = client
        .get(&normalized_url)
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

    // 4. Parse the feed.
    let parsed = parse_feed(&xml)?;

    // Reject non-feed content: must have either a title or at least one entry.
    if parsed.entries.is_empty() && parsed.title.is_none() {
        return Err(AppError::Feed(
            "The URL does not appear to be a valid RSS/Atom/JSON Feed. No entries or title found.".into(),
        ));
    }

    // 5. Resolve the feed title.
    let resolved_title = resolve_title(
        title.as_deref(),
        parsed.title.as_deref(),
        parsed.site_url.as_deref(),
    )?;

    let now = chrono::Utc::now().to_rfc3339();

    // 6. Upsert the feed.
    let feed = state
        .feed_store
        .upsert(Feed {
            id: 0, // SQLite will assign the real ID
            title: resolved_title,
            feed_url: normalized_url,
            site_url: parsed.site_url,
            feed_parser_version: Some(1),
            last_fetched_at: Some(now),
            created_at: chrono::Utc::now().to_rfc3339(),
        })
        .await?;

    // 7. Upsert the parsed entries.
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

    state.entry_store.upsert_entries(feed.id, &entry_data).await?;

    Ok(feed)
}

#[tauri::command]
pub async fn get_feeds(
    state: State<'_, AppState>,
) -> Result<Vec<Feed>, AppError> {
    state.feed_store.load_all().await
}

#[tauri::command]
pub async fn update_feed(
    state: State<'_, AppState>,
    id: i64,
    url: String,
    title: Option<String>,
) -> Result<Feed, AppError> {
    let normalized_url = validate_url(&url)?;

    // Build updated feed from existing data + new values.
    let existing_feeds = state.feed_store.load_all().await?;
    let existing = existing_feeds
        .into_iter()
        .find(|f| f.id == id)
        .ok_or_else(|| AppError::NotFound(format!("Feed with id {} not found", id)))?;

    let resolved_title = title.unwrap_or(existing.title);

    let updated = Feed {
        id,
        title: resolved_title,
        feed_url: normalized_url,
        site_url: existing.site_url,
        feed_parser_version: existing.feed_parser_version,
        last_fetched_at: existing.last_fetched_at,
        created_at: existing.created_at,
    };

    state.feed_store.upsert(updated).await
}

#[tauri::command]
pub async fn delete_feed(
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), AppError> {
    state.feed_store.delete(id).await
}

#[tauri::command]
pub async fn sync_feeds(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    concurrency: u32,
) -> Result<Vec<crate::feed::sync_service::SyncResult>, AppError> {
    use crate::feed::sync_service::SyncStatus;
    let handle = app_handle.clone();
    let results = state.sync_service.sync_all(concurrency, move |feed, status, completed, total| {
        let _ = handle.emit("sync-progress", serde_json::json!({
            "feed_id": feed.id,
            "feed_title": feed.title,
            "status": match status {
                SyncStatus::Fetching => "syncing",
                SyncStatus::Completed => "done",
                SyncStatus::Failed(_) => "error",
                _ => "pending",
            },
            "completed": completed,
            "total": total,
        }));
    }).await?;

    Ok(results)
}

/// Validate a feed URL and return the detected title without saving anything.
#[tauri::command]
pub async fn probe_feed(
    url: String,
) -> Result<serde_json::Value, AppError> {
    let normalized_url = crate::feed::feed_validator::validate_url(&url)?;

    let client = reqwest::Client::new();
    let xml = client
        .get(&normalized_url)
        .send()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?
        .text()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;

    let parsed = parse_feed(&xml)?;

    if parsed.entries.is_empty() && parsed.title.is_none() {
        return Err(AppError::Feed(
            "The URL does not appear to be a valid RSS/Atom/JSON Feed".into(),
        ));
    }

    Ok(serde_json::json!({
        "title": parsed.title,
        "site_url": parsed.site_url,
        "entry_count": parsed.entries.len(),
    }))
}

#[tauri::command]
pub async fn import_opml(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    path: String,
    replace: bool,
    force_site_name: bool,
    concurrency: Option<u32>,
) -> Result<ImportResult, AppError> {
    let outlines = OpmlImporter::import(&path)?;
    OpmlImporter::import_into_db(
        &outlines,
        replace,
        force_site_name,
        concurrency.unwrap_or(4),
        state.feed_store.clone(),
        state.entry_store.clone(),
        app_handle,
    )
    .await
}

#[tauri::command]
pub async fn export_opml(
    state: State<'_, AppState>,
    path: String,
) -> Result<(), AppError> {
    let feeds = state.feed_store.load_all().await?;
    OpmlExporter::export(&feeds, &path)
}

#[tauri::command]
pub async fn get_sidebar_projection(
    state: State<'_, AppState>,
) -> Result<crate::feed::sidebar_counts::SidebarProjection, AppError> {
    tokio::task::spawn_blocking({
        let db = state.db.clone();
        move || crate::feed::sidebar_counts::compute_projection(&db)
    })
    .await
    .map_err(|e| AppError::Unknown(format!("{e}")))?
}

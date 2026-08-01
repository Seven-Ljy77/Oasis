use tauri::State;
use rusqlite::params;

use crate::db::entry_store::{EntryStore, SearchScope};
use crate::db::models::EntryListItem;
use crate::db::tag_store::TagStore;
use crate::db::query_builder::{EntryListQuery, PageCursor, TagMatchMode};
use crate::error::AppError;
use crate::state::AppState;

use serde::{Deserialize, Serialize};

/// Query parameters for loading the entry list (IPC DTO).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadEntriesQuery {
    pub feed_id: Option<i64>,
    pub tag_ids: Option<Vec<i64>>,
    pub tag_match_mode: Option<String>,
    pub unread_only: bool,
    pub starred_only: Option<bool>,
    pub search_text: Option<String>,
    pub cursor: Option<PageCursor>,
    pub limit: Option<u32>,
}

/// A page of entry results (IPC DTO).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadEntriesPage {
    pub entries: Vec<EntryListItem>,
    pub next_cursor: Option<PageCursor>,
}

/// Map the IPC query DTO to the internal query builder type.
fn into_query_builder_query(q: LoadEntriesQuery) -> EntryListQuery {
    let tag_match_mode = match q.tag_match_mode.as_deref() {
        Some("all") | Some("All") => TagMatchMode::All,
        _ => TagMatchMode::Any,
    };

    let tag_ids = q.tag_ids.unwrap_or_default();

    EntryListQuery {
        feed_id: q.feed_id,
        unread_only: q.unread_only,
        starred_only: q.starred_only.unwrap_or(false),
        tag_ids,
        tag_match_mode,
        search_text: q.search_text,
        cursor: q.cursor,
        limit: q.limit.unwrap_or(50).max(1),
    }
}

#[tauri::command]
pub async fn load_entries(
    state: State<'_, AppState>,
    query: LoadEntriesQuery,
) -> Result<LoadEntriesPage, AppError> {
    let internal_query = into_query_builder_query(query);
    let page = state.entry_store.load_page(internal_query).await?;
    Ok(LoadEntriesPage {
        entries: page.entries,
        next_cursor: page.next_cursor,
    })
}

#[tauri::command]
pub async fn load_next_entries(
    state: State<'_, AppState>,
    query: LoadEntriesQuery,
) -> Result<LoadEntriesPage, AppError> {
    let page = state
        .entry_store
        .load_page(into_query_builder_query(query))
        .await?;
    Ok(LoadEntriesPage {
        entries: page.entries,
        next_cursor: page.next_cursor,
    })
}

#[tauri::command]
pub async fn mark_read(
    state: State<'_, AppState>,
    entry_ids: Vec<i64>,
    is_read: bool,
) -> Result<(), AppError> {
    state.entry_store.mark_read(&entry_ids, is_read).await
}

#[tauri::command]
pub async fn mark_starred(
    state: State<'_, AppState>,
    entry_id: i64,
    is_starred: bool,
) -> Result<(), AppError> {
    state.entry_store.mark_starred(entry_id, is_starred).await
}

#[tauri::command]
pub async fn mark_all_read(
    state: State<'_, AppState>,
    query: crate::db::query_builder::EntryListQuery,
    is_read: bool,
) -> Result<u64, AppError> {
    state.entry_store.mark_all_read(&query, is_read).await
}

#[tauri::command]
pub async fn delete_all_entries(
    state: State<'_, AppState>,
    query: crate::db::query_builder::EntryListQuery,
) -> Result<u64, AppError> {
    state.entry_store.delete_all_entries(&query).await
}

#[tauri::command]
pub async fn delete_entry(
    state: State<'_, AppState>,
    entry_id: i64,
) -> Result<(), AppError> {
    state.entry_store.delete_entry(entry_id).await?;
    state.tag_store.recalculate_counts().await
}

#[tauri::command]
pub async fn search_entries(
    state: State<'_, AppState>,
    text: String,
    scope: String,
) -> Result<Vec<EntryListItem>, AppError> {
    let search_scope = match scope.as_str() {
        "title_only" | "TitleOnly" => SearchScope::TitleOnly,
        "title_and_summary" | "TitleAndSummary" => SearchScope::TitleAndSummary,
        "title_summary_content" | "TitleSummaryContent" => SearchScope::TitleSummaryContent,
        _ => SearchScope::TitleAndSummary, // default
    };

    state.entry_store.search(&text, search_scope).await
}

/// Results grouped by match category.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategorizedSearchResults {
    pub by_content: Vec<EntryListItem>,
    pub by_tag: Vec<EntryListItem>,
    pub by_note: Vec<EntryListItem>,
}

#[tauri::command]
pub async fn search_categorized(
    state: State<'_, AppState>,
    text: String,
) -> Result<CategorizedSearchResults, AppError> {
    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        return Ok(CategorizedSearchResults {
            by_content: vec![],
            by_tag: vec![],
            by_note: vec![],
        });
    }
    let like = format!("%{}%", &trimmed);
    let db = state.db.clone();

    tokio::task::spawn_blocking(move || {
        db.read(|conn| {
            // 1. Articles matching title / summary / content
            let by_content = search_entry_list(conn,
                "e.title LIKE ?1 OR e.summary LIKE ?1 OR e.id IN (SELECT entry_id FROM content WHERE markdown LIKE ?1)",
                &like,
            )?;

            // 2. Articles whose tags match the search text
            let by_tag = search_entry_list(conn,
                "e.id IN (SELECT et.entry_id FROM entry_tag et JOIN tag t ON et.tag_id = t.id WHERE t.name LIKE ?1)",
                &like,
            )?;

            // 3. Articles whose notes match the search text
            let by_note = search_entry_list(conn,
                "e.id IN (SELECT entry_id FROM entry_note WHERE markdown_text LIKE ?1)",
                &like,
            )?;

            Ok(CategorizedSearchResults { by_content, by_tag, by_note })
        })
    })
    .await
    .map_err(|e| AppError::Database(e.to_string()))?
}

fn search_entry_list(
    conn: &rusqlite::Connection,
    condition: &str,
    like: &str,
) -> Result<Vec<EntryListItem>, AppError> {
    let sql = format!(
        "SELECT e.id, e.feed_id, e.title, e.author, e.url, e.published_at, e.summary, \
         e.is_read, e.is_starred, f.title AS feed_title, e.created_at \
         FROM entry e JOIN feed f ON e.feed_id = f.id \
         WHERE e.is_deleted = 0 AND {} \
         ORDER BY e.published_at DESC LIMIT 50",
        condition,
    );
    let mut stmt = conn.prepare(&sql)?;
    let entries = stmt
        .query_map(params![like], |row| {
            Ok(EntryListItem {
                id: row.get(0)?,
                feed_id: row.get(1)?,
                title: row.get(2)?,
                author: row.get(3)?,
                url: row.get(4)?,
                published_at: row.get(5)?,
                summary: row.get(6)?,
                is_read: row.get(7)?,
                is_starred: row.get(8)?,
                feed_title: row.get(9)?,
                created_at: row.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(entries)
}

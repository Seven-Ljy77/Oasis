use tauri::State;
use rusqlite::params;

use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
pub async fn save_note(
    state: State<'_, AppState>,
    entry_id: i64,
    text: String,
) -> Result<(), AppError> {
    let markdown_text = text;
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.conn();
        if markdown_text.trim().is_empty() {
            // Delete empty notes
            conn.execute(
                "DELETE FROM entry_note WHERE entry_id = ?1",
                params![entry_id],
            )?;
        } else {
            conn.execute(
                "INSERT INTO entry_note (entry_id, markdown_text, created_at, updated_at) \
                 VALUES (?1, ?2, datetime('now'), datetime('now')) \
                 ON CONFLICT(entry_id) DO UPDATE SET \
                    markdown_text = excluded.markdown_text, \
                    updated_at = datetime('now')",
                params![entry_id, markdown_text],
            )?;
        }
        Ok::<_, AppError>(())
    })
    .await
    .map_err(|e| AppError::Database(e.to_string()))?
}

#[tauri::command]
pub async fn get_note(
    state: State<'_, AppState>,
    entry_id: i64,
) -> Result<Option<serde_json::Value>, AppError> {
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.conn();
        let result = conn.query_row(
            "SELECT markdown_text FROM entry_note WHERE entry_id = ?1",
            params![entry_id],
            |row| row.get::<_, String>(0),
        );
        match result {
            Ok(text) if !text.trim().is_empty() => Ok(Some(serde_json::json!({ "text": text }))),
            _ => Ok(None),
        }
    })
    .await
    .map_err(|e| AppError::Database(e.to_string()))?
}

fn get_template(state: &AppState) -> String {
    state.config.try_read().map(|c| c.digest_template.clone()).unwrap_or_else(|_| "default".into())
}

#[tauri::command]
pub async fn share_digest(
    state: State<'_, AppState>,
    entry_id: i64,
) -> Result<String, AppError> {
    let template = get_template(&state);
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.conn();
        build_single_digest(&conn, entry_id, &template)
    })
    .await
    .map_err(|e| AppError::Database(e.to_string()))?
}

#[tauri::command]
pub async fn export_digest(
    state: State<'_, AppState>,
    entry_id: i64,
    path: String,
) -> Result<(), AppError> {
    let template = get_template(&state);
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.conn();
        let markdown = build_single_digest(&conn, entry_id, &template)?;
        std::fs::write(&path, markdown)
            .map_err(|e| AppError::Digest(format!("Failed to write file: {}", e)))?;
        Ok(())
    })
    .await
    .map_err(|e| AppError::Database(e.to_string()))?
}

#[tauri::command]
pub async fn export_multiple_digest(
    state: State<'_, AppState>,
    entry_ids: Vec<i64>,
    path: String,
) -> Result<(), AppError> {
    let template = get_template(&state);
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.conn();
        let mut parts = vec![format!("# Digest — {}\n", chrono::Local::now().format("%Y-%m-%d"))];
        for &eid in &entry_ids {
            match build_single_digest(&conn, eid, &template) {
                Ok(md) => parts.push(format!("## {}\n\n{}", get_entry_title(&conn, eid), md)),
                Err(_) => parts.push(format!("## Entry #{} (unavailable)\n", eid)),
            }
        }
        let markdown = parts.join("\n");
        std::fs::write(&path, markdown)
            .map_err(|e| AppError::Digest(format!("Failed to write file: {}", e)))?;
        Ok(())
    })
    .await
    .map_err(|e| AppError::Database(e.to_string()))?
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn build_single_digest(
    conn: &rusqlite::Connection,
    entry_id: i64,
    template: &str,
) -> Result<String, AppError> {
    let title = get_entry_title(conn, entry_id);
    let author = conn.query_row(
        "SELECT author FROM entry WHERE id = ?1",
        params![entry_id],
        |row| row.get::<_, Option<String>>(0),
    ).ok().flatten().unwrap_or_default();

    let url = conn.query_row(
        "SELECT url FROM entry WHERE id = ?1",
        params![entry_id],
        |row| row.get::<_, Option<String>>(0),
    ).ok().flatten().unwrap_or_default();

    let summary = conn.query_row(
        "SELECT text FROM summary_result WHERE entry_id = ?1 ORDER BY created_at DESC LIMIT 1",
        params![entry_id],
        |row| row.get::<_, Option<String>>(0),
    ).ok().flatten();

    let note = conn.query_row(
        "SELECT markdown_text FROM entry_note WHERE entry_id = ?1",
        params![entry_id],
        |row| row.get::<_, Option<String>>(0),
    ).ok().flatten();

    let published = conn.query_row(
        "SELECT published_at FROM entry WHERE id = ?1",
        params![entry_id],
        |row| row.get::<_, Option<String>>(0),
    ).ok().flatten().unwrap_or_default();

    match template {
        "minimal" => {
            let mut md = format!("# {}\n\n", title);
            if !url.is_empty() { md.push_str(&format!("{}\n\n", url)); }
            if let Some(s) = &summary {
                for line in s.lines() { md.push_str(&format!("> {}\n", line)); }
                md.push('\n');
            }
            if let Some(n) = &note {
                md.push_str(n);
                md.push('\n');
            }
            Ok(md)
        }
        "academic" => {
            let mut md = format!("# {}\n\n", title);
            if !author.is_empty() { md.push_str(&format!("**Author:** {}\n\n", author)); }
            if !published.is_empty() { md.push_str(&format!("**Published:** {}\n\n", published)); }
            if !url.is_empty() { md.push_str(&format!("**Source:** [{}]({})\n\n", url, url)); }
            if let Some(s) = &summary {
                md.push_str("## Abstract\n\n");
                for line in s.lines() { md.push_str(&format!("> {}\n", line)); }
                md.push('\n');
            }
            if let Some(n) = &note {
                md.push_str("## Commentary\n\n");
                md.push_str(n);
                md.push('\n');
            }
            Ok(md)
        }
        "newsletter" => {
            let mut md = format!("---\ntitle: \"{}\"\n", title);
            if !author.is_empty() { md.push_str(&format!("author: \"{}\"\n", author)); }
            if !published.is_empty() { md.push_str(&format!("date: \"{}\"\n", published)); }
            if !url.is_empty() { md.push_str(&format!("url: \"{}\"\n", url)); }
            md.push_str("---\n\n");
            md.push_str(&format!("# {}\n\n", title));
            md.push_str(&format!("*By {}*\n\n", author));
            if let Some(s) = &summary {
                md.push_str("## Highlights\n\n");
                for line in s.lines() { md.push_str(&format!("- {}\n", line)); }
                md.push('\n');
            }
            if let Some(n) = &note {
                md.push_str("## Editor's Note\n\n");
                md.push_str(n);
                md.push('\n');
            }
            Ok(md)
        }
        _ => { // default
            let mut md = format!("# {}\n\n", title);
            if !author.is_empty() { md.push_str(&format!("*By {}*\n\n", author)); }
            if !published.is_empty() { md.push_str(&format!("*Published: {}*\n\n", published)); }
            if !url.is_empty() { md.push_str(&format!("[Read original]({})\n\n", url)); }
            if let Some(s) = &summary {
                md.push_str("## Summary\n\n");
                for line in s.lines() { md.push_str(&format!("> {}\n", line)); }
                md.push('\n');
            }
            if let Some(n) = &note {
                md.push_str("## Notes\n\n");
                md.push_str(n);
                md.push('\n');
            }
            Ok(md)
        }
    }
}

fn get_entry_title(conn: &rusqlite::Connection, entry_id: i64) -> String {
    conn.query_row(
        "SELECT title FROM entry WHERE id = ?1",
        params![entry_id],
        |row| row.get::<_, Option<String>>(0),
    )
    .ok()
    .flatten()
    .unwrap_or_else(|| format!("Untitled Entry #{}", entry_id))
}

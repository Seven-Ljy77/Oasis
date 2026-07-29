use tauri::State;
use rusqlite::params;

use crate::digest::template::DigestTemplateStore;
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

fn get_template_id(state: &AppState) -> String {
    state.config.try_read().map(|c| c.digest_template.clone()).unwrap_or_else(|_| "default".into())
}

fn make_template_store() -> DigestTemplateStore {
    let user_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Oasis")
        .join("prompts")
        .to_string_lossy()
        .to_string();
    DigestTemplateStore::new(Some(user_dir))
}

#[tauri::command]
pub async fn share_digest(
    state: State<'_, AppState>,
    entry_id: i64,
) -> Result<String, AppError> {
    let template_id = get_template_id(&state);
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.conn();
        build_single_digest(&conn, entry_id, &template_id)
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
    let template_id = get_template_id(&state);
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.conn();
        let markdown = build_single_digest(&conn, entry_id, &template_id)?;
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
    let template_id = get_template_id(&state);
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.conn();
        let mut parts = vec![format!("# Digest — {}\n", chrono::Local::now().format("%Y-%m-%d"))];
        for &eid in &entry_ids {
            match build_single_digest(&conn, eid, &template_id) {
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

#[tauri::command]
pub async fn export_articles(
    state: State<'_, AppState>,
    entry_ids: Vec<i64>,
    path: String,
) -> Result<(), AppError> {
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.conn();
        let mut parts = vec![format!("# Articles — {}\n", chrono::Local::now().format("%Y-%m-%d"))];
        for &eid in &entry_ids {
            let title = get_entry_title(&conn, eid);
            let url = conn.query_row(
                "SELECT url FROM entry WHERE id = ?1",
                params![eid],
                |row| row.get::<_, Option<String>>(0),
            ).ok().flatten().unwrap_or_default();

            let author = conn.query_row(
                "SELECT author FROM entry WHERE id = ?1",
                params![eid],
                |row| row.get::<_, Option<String>>(0),
            ).ok().flatten().unwrap_or_default();

            let markdown = conn.query_row(
                "SELECT markdown FROM content WHERE entry_id = ?1",
                params![eid],
                |row| row.get::<_, Option<String>>(0),
            ).ok().flatten().unwrap_or_default();

            let published = conn.query_row(
                "SELECT published_at FROM entry WHERE id = ?1",
                params![eid],
                |row| row.get::<_, Option<String>>(0),
            ).ok().flatten().unwrap_or_default();

            parts.push(format!("## {}\n", title));
            if !author.is_empty() {
                parts.push(format!("*{}*\n", author));
            }
            if !url.is_empty() {
                parts.push(format!("[{}]({})\n", url, url));
            }
            if !published.is_empty() {
                parts.push(format!("*Published: {}*\n", published));
            }
            parts.push(String::new());
            if !markdown.is_empty() {
                parts.push(markdown);
            } else {
                let summary = conn.query_row(
                    "SELECT summary FROM entry WHERE id = ?1",
                    params![eid],
                    |row| row.get::<_, Option<String>>(0),
                ).ok().flatten().unwrap_or_default();
                if !summary.is_empty() {
                    parts.push(summary);
                } else {
                    parts.push("*No content available*\n".to_string());
                }
            }
            parts.push(String::new());
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
    template_id: &str,
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

    // Load the template from the store and render with Tera.
    let store = make_template_store();
    let tpl = store.load(template_id)?;

    let mut context = tera::Context::new();
    context.insert("title", &title);
    context.insert("author", &author);
    context.insert("url", &url);
    context.insert("published_at", &published);
    if let Some(ref s) = summary { context.insert("summary", s); }
    if let Some(ref n) = note { context.insert("note", n); }

    tpl.render(&context)
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

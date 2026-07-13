use rusqlite::Connection;

use crate::error::AppError;

/// Runs ordered schema migrations embedded from the `migrations/` directory.
pub struct MigrationRunner;

impl MigrationRunner {
    /// Execute all migrations in order. Each migration is a .sql file whose
    /// name starts with a zero-padded sequence number.
    pub fn run(conn: &Connection) -> Result<(), AppError> {
        // Create the migration tracking table if it does not exist.
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS _migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        )?;

        let migrations: Vec<(&str, &str)> = vec![
            ("001_create_feed", include_str!("../../migrations/001_create_feed.sql")),
            ("002_create_entry", include_str!("../../migrations/002_create_entry.sql")),
            ("003_create_content", include_str!("../../migrations/003_create_content.sql")),
            ("004_create_content_html_cache", include_str!("../../migrations/004_create_content_html_cache.sql")),
            ("005_create_tag_tables", include_str!("../../migrations/005_create_tag_tables.sql")),
            ("006_create_entry_note", include_str!("../../migrations/006_create_entry_note.sql")),
            ("007_create_agent_provider", include_str!("../../migrations/007_create_agent_provider.sql")),
            ("008_create_agent_model", include_str!("../../migrations/008_create_agent_model.sql")),
            ("009_create_agent_profile", include_str!("../../migrations/009_create_agent_profile.sql")),
            ("010_create_agent_task_run", include_str!("../../migrations/010_create_agent_task_run.sql")),
            ("011_create_llm_usage_event", include_str!("../../migrations/011_create_llm_usage_event.sql")),
            ("012_create_summary_result", include_str!("../../migrations/012_create_summary_result.sql")),
            ("013_create_translation_tables", include_str!("../../migrations/013_create_translation_tables.sql")),
            ("014_create_tag_batch_tables", include_str!("../../migrations/014_create_tag_batch_tables.sql")),
            ("015_create_indexes", include_str!("../../migrations/015_create_indexes.sql")),
        ];

        for (name, sql) in migrations {
            let already_applied: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM _migrations WHERE name = ?1",
                    [name],
                    |row| row.get(0),
                )
                .unwrap_or(false);

            if !already_applied {
                conn.execute_batch(sql)?;
                conn.execute(
                    "INSERT INTO _migrations (name) VALUES (?1)",
                    [name],
                )?;
            }
        }

        Ok(())
    }
}

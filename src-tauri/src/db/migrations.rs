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
            ("016_cleanup_empty_tags", include_str!("../../migrations/016_cleanup_empty_tags.sql")),
            ("017_undelete_entries", include_str!("../../migrations/017_undelete_entries.sql")),
            ("018_agent_config_unique", include_str!("../../migrations/018_agent_config_unique.sql")),
            ("019_summary_task_optional", include_str!("../../migrations/019_summary_task_optional.sql")),
            ("020_track_provider_archives", include_str!("../../migrations/020_track_provider_archives.sql")),
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
                conn.execute_batch("SAVEPOINT oasis_migration")?;
                let result = conn.execute_batch(sql).and_then(|_| {
                    conn.execute("INSERT INTO _migrations (name) VALUES (?1)", [name])?;
                    Ok(())
                });
                match result {
                    Ok(()) => conn.execute_batch("RELEASE SAVEPOINT oasis_migration")?,
                    Err(error) => {
                        let _ = conn.execute_batch(
                            "ROLLBACK TO SAVEPOINT oasis_migration; RELEASE SAVEPOINT oasis_migration",
                        );
                        return Err(error.into());
                    }
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use rusqlite::{Connection, params};

    use super::MigrationRunner;

    #[test]
    fn fresh_database_applies_all_migrations_and_accepts_untracked_summary() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON").unwrap();

        MigrationRunner::run(&conn).unwrap();
        MigrationRunner::run(&conn).unwrap();

        let migration_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM _migrations", [], |row| row.get(0))
            .unwrap();
        assert_eq!(migration_count, 20);

        conn.execute(
            "INSERT INTO feed (title, feed_url) VALUES ('Feed', 'https://example.com/feed')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO entry (feed_id, guid, title) VALUES (1, 'entry-1', 'Entry')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO summary_result (task_run_id, entry_id, target_language, detail_level, text) VALUES (NULL, 1, 'en', 'medium', 'Summary')",
            [],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO agent_provider_profile (name, base_url, api_key_ref) VALUES ('OpenAI', 'https://api.openai.com/v1', 'key-ref')",
            [],
        )
        .unwrap();
        let duplicate = conn.execute(
            "INSERT INTO agent_provider_profile (name, base_url, api_key_ref) VALUES ('openai', 'https://example.com/v1', 'other-ref')",
            [],
        );
        assert!(duplicate.is_err());
        conn.execute(
            "INSERT INTO agent_provider_profile (name, base_url, api_key_ref, is_archived) VALUES ('openai', 'https://example.com/v1', 'other-ref', 1)",
            [],
        )
        .unwrap();

        let foreign_key_errors: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_foreign_key_check",
                params![],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(foreign_key_errors, 0);
    }

    #[test]
    fn agent_config_migration_keeps_active_rows_and_remaps_routes() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            concat!(
                include_str!("../../migrations/007_create_agent_provider.sql"),
                include_str!("../../migrations/008_create_agent_model.sql"),
                include_str!("../../migrations/009_create_agent_profile.sql"),
                "CREATE TABLE translation_result (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entry_id INTEGER NOT NULL,
                    target_language TEXT NOT NULL,
                    run_status TEXT NOT NULL
                );
                CREATE TABLE translation_segment (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    translation_result_id INTEGER NOT NULL
                        REFERENCES translation_result(id) ON DELETE CASCADE
                );"
            ),
        )
        .unwrap();
        conn.execute_batch(
            "INSERT INTO agent_provider_profile
                (id, name, base_url, api_key_ref, is_default, is_enabled, is_archived)
             VALUES
                (1, 'OpenAI', 'https://old.example/v1', 'old', 0, 1, 1),
                (2, 'openai', 'https://active.example/v1', 'active', 1, 1, 0),
                (3, 'Other', 'https://other.example/v1', 'other', 1, 1, 0);
             INSERT INTO agent_model_profile
                (id, provider_profile_id, model_name, is_default, is_enabled, is_archived)
             VALUES
                (1, 1, 'GPT', 0, 1, 0),
                (2, 2, 'gpt', 1, 1, 0);
             INSERT INTO agent_profile
                (agent_type, primary_model_profile_id, fallback_model_profile_id)
             VALUES ('summary', 1, 1);
             INSERT INTO translation_result
                (id, entry_id, target_language, run_status)
             VALUES
                (1, 10, 'en', 'succeeded'),
                (2, 10, 'en', 'failed');",
        )
        .unwrap();

        conn.execute_batch(include_str!("../../migrations/018_agent_config_unique.sql"))
            .unwrap();

        let active_provider: i64 = conn
            .query_row(
                "SELECT id FROM agent_provider_profile
                 WHERE name = 'openai' COLLATE NOCASE AND is_archived = 0",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(active_provider, 2);

        let active_model: i64 = conn
            .query_row(
                "SELECT id FROM agent_model_profile
                 WHERE provider_profile_id = 2
                   AND model_name = 'gpt' COLLATE NOCASE
                   AND is_archived = 0",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(active_model, 2);

        let routed_model: i64 = conn
            .query_row(
                "SELECT primary_model_profile_id FROM agent_profile
                 WHERE agent_type = 'summary'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(routed_model, 2);

        let kept_translation: i64 = conn
            .query_row("SELECT id FROM translation_result", [], |row| row.get(0))
            .unwrap();
        assert_eq!(kept_translation, 1);

        let default_provider_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM agent_provider_profile
                 WHERE is_default = 1 AND is_archived = 0",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(default_provider_count, 1);
    }

    #[test]
    fn agent_config_migration_normalizes_names_and_prefers_enabled_default_models() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(concat!(
            include_str!("../../migrations/007_create_agent_provider.sql"),
            include_str!("../../migrations/008_create_agent_model.sql"),
            include_str!("../../migrations/009_create_agent_profile.sql"),
            "CREATE TABLE translation_result (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entry_id INTEGER NOT NULL,
                    target_language TEXT NOT NULL,
                    run_status TEXT NOT NULL
                );
                CREATE TABLE translation_segment (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    translation_result_id INTEGER NOT NULL
                        REFERENCES translation_result(id) ON DELETE CASCADE
                );"
        ))
        .unwrap();
        conn.execute_batch(
            "INSERT INTO agent_provider_profile
                (id, name, base_url, api_key_ref, is_default, is_enabled, is_archived)
             VALUES
                (1, '  OpenAI  ', 'https://enabled.example/v1', 'enabled', 0, 1, 0),
                (2, 'openai', 'https://disabled.example/v1', 'disabled', 1, 0, 0),
                (3, '   ', 'https://unnamed-3.example/v1', 'unnamed-3', 0, 1, 0),
                (4, '', 'https://unnamed-4.example/v1', 'unnamed-4', 0, 1, 0),
                (5, '  Models  ', 'https://models.example/v1', 'models', 0, 1, 0);
             INSERT INTO agent_model_profile
                (id, provider_profile_id, model_name, is_default, is_enabled, is_archived)
             VALUES
                (1, 1, '  GPT-4  ', 0, 1, 0),
                (2, 2, 'gpt-4', 1, 0, 0),
                (10, 5, '  enabled-old  ', 1, 1, 0),
                (11, 5, 'enabled-new', 1, 1, 0),
                (12, 5, 'disabled-newest', 1, 0, 0),
                (13, 5, '   ', 0, 1, 0);
             INSERT INTO agent_profile
                (agent_type, primary_model_profile_id, fallback_model_profile_id)
             VALUES ('summary', 2, 2);",
        )
        .unwrap();

        conn.execute_batch(include_str!("../../migrations/018_agent_config_unique.sql"))
            .unwrap();

        let provider_names: Vec<(i64, String)> = conn
            .prepare(
                "SELECT id, name FROM agent_provider_profile
                 WHERE is_archived = 0 ORDER BY id",
            )
            .unwrap()
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(
            provider_names,
            vec![
                (1, "OpenAI".to_string()),
                (3, "Unnamed Provider 3".to_string()),
                (4, "Unnamed Provider 4".to_string()),
                (5, "Models".to_string()),
            ]
        );

        let active_gpt: (i64, i64, String) = conn
            .query_row(
                "SELECT id, provider_profile_id, model_name
                 FROM agent_model_profile
                 WHERE model_name = 'gpt-4' COLLATE NOCASE AND is_archived = 0",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(active_gpt, (1, 1, "GPT-4".to_string()));

        let unnamed_model: String = conn
            .query_row(
                "SELECT model_name FROM agent_model_profile WHERE id = 13",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(unnamed_model, "Unnamed Model 13");

        let routed_models: (i64, i64) = conn
            .query_row(
                "SELECT primary_model_profile_id, fallback_model_profile_id
                 FROM agent_profile WHERE agent_type = 'summary'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(routed_models, (1, 1));

        let default_model: i64 = conn
            .query_row(
                "SELECT id FROM agent_model_profile
                 WHERE provider_profile_id = 5
                   AND is_default = 1
                   AND is_archived = 0",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(default_model, 11);
    }

    #[test]
    fn provider_archive_tracking_backfills_legacy_cascades() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(concat!(
            include_str!("../../migrations/007_create_agent_provider.sql"),
            include_str!("../../migrations/008_create_agent_model.sql"),
            "INSERT INTO agent_provider_profile
                 (id, name, base_url, api_key_ref, is_archived)
             VALUES (1, 'Legacy', 'https://example.com/v1', 'key', 1);
             INSERT INTO agent_model_profile
                 (id, provider_profile_id, model_name, is_archived)
             VALUES (1, 1, 'legacy-model', 1);",
            include_str!("../../migrations/020_track_provider_archives.sql")
        ))
        .unwrap();

        let archived_by_provider: bool = conn
            .query_row(
                "SELECT archived_by_provider FROM agent_model_profile WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(archived_by_provider);
    }
}

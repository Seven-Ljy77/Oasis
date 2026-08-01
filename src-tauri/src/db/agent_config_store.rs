use std::sync::Arc;

use async_trait::async_trait;
use rusqlite::{params, Connection, OptionalExtension};

use crate::db::manager::DatabaseManager;
use crate::db::models::{AgentModelProfile, AgentProfile, AgentProviderProfile};
use crate::error::AppError;

/// Persistence operations for AI agent configuration: providers, models, and
/// agent-type-to-model routing profiles.
#[async_trait]
pub trait AgentConfigStore: Send + Sync {
    // --- Providers ---

    /// Load all provider profiles (optionally excluding archived ones).
    async fn load_providers(
        &self,
        include_archived: bool,
    ) -> Result<Vec<AgentProviderProfile>, AppError>;

    /// Insert or update a provider profile.
    async fn upsert_provider(
        &self,
        provider: &AgentProviderProfile,
    ) -> Result<AgentProviderProfile, AppError>;

    /// Archive (soft-delete) a provider.
    async fn archive_provider(&self, id: i64) -> Result<(), AppError>;

    /// Restore a provider and its models without overwriting their data.
    async fn unarchive_provider(&self, id: i64) -> Result<(), AppError>;

    // --- Models ---

    /// Load all model profiles for a given provider.
    async fn load_models(
        &self,
        provider_profile_id: i64,
        include_archived: bool,
    ) -> Result<Vec<AgentModelProfile>, AppError>;

    /// Insert or update a model profile.
    async fn upsert_model(
        &self,
        model: &AgentModelProfile,
    ) -> Result<AgentModelProfile, AppError>;

    /// Archive (soft-delete) a model profile.
    async fn archive_model(&self, id: i64) -> Result<(), AppError>;

    // --- Agent Profiles (routing) ---

    /// Load all agent routing profiles.
    async fn load_profiles(&self) -> Result<Vec<AgentProfile>, AppError>;

    /// Insert or update an agent routing profile.
    async fn upsert_profile(
        &self,
        profile: &AgentProfile,
    ) -> Result<AgentProfile, AppError>;

    /// Set the specified provider/model as the default for its scope.
    async fn set_default(&self, id: i64) -> Result<(), AppError>;
}

// =============================================================================
// SQLite Implementation
// =============================================================================

pub struct SqliteAgentConfigStore {
    db: Arc<DatabaseManager>,
}

impl SqliteAgentConfigStore {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl AgentConfigStore for SqliteAgentConfigStore {
    // --- Providers ---

    async fn load_providers(
        &self,
        include_archived: bool,
    ) -> Result<Vec<AgentProviderProfile>, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let sql = if include_archived {
                    "SELECT id, name, base_url, api_key_ref, test_model, \
                     is_default, is_enabled, is_archived, archived_at, created_at \
                     FROM agent_provider_profile ORDER BY name COLLATE NOCASE"
                } else {
                    "SELECT id, name, base_url, api_key_ref, test_model, \
                     is_default, is_enabled, is_archived, archived_at, created_at \
                     FROM agent_provider_profile WHERE is_archived = 0 ORDER BY name COLLATE NOCASE"
                };
                let mut stmt = conn.prepare(sql)?;
                let providers = stmt
                    .query_map([], |row| {
                        Ok(AgentProviderProfile {
                            id: row.get(0)?,
                            name: row.get(1)?,
                            base_url: row.get(2)?,
                            api_key_ref: row.get(3)?,
                            test_model: row.get(4)?,
                            is_default: row.get(5)?,
                            is_enabled: row.get(6)?,
                            is_archived: row.get(7)?,
                            archived_at: row.get(8)?,
                            created_at: row.get(9)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(providers)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn upsert_provider(
        &self,
        provider: &AgentProviderProfile,
    ) -> Result<AgentProviderProfile, AppError> {
        let p = provider.clone();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                if p.id != 0 {
                    let updated = conn.execute(
                        "UPDATE agent_provider_profile SET \
                            name = ?1, base_url = ?2, api_key_ref = ?3, test_model = ?4, \
                            is_default = ?5, is_enabled = ?6, is_archived = ?7 \
                         WHERE id = ?8",
                        params![
                            p.name, p.base_url, p.api_key_ref, p.test_model,
                            p.is_default, p.is_enabled, p.is_archived, p.id,
                        ],
                    )?;
                    if updated == 0 {
                        return Err(AppError::NotFound(format!(
                            "Provider not found: {}",
                            p.id
                        )));
                    }
                } else {
                    conn.execute(
                        "INSERT INTO agent_provider_profile \
                         (name, base_url, api_key_ref, test_model, is_default, is_enabled, is_archived) \
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        params![
                            p.name, p.base_url, p.api_key_ref, p.test_model,
                            p.is_default, p.is_enabled, p.is_archived,
                        ],
                    )?;
                }
                let id = if p.id != 0 { p.id } else { conn.last_insert_rowid() };
                if p.is_default {
                    conn.execute(
                        "UPDATE agent_provider_profile SET is_default = (id = ?1)",
                        params![id],
                    )?;
                }
                let stored = conn.query_row(
                    "SELECT id, name, base_url, api_key_ref, test_model, \
                     is_default, is_enabled, is_archived, archived_at, created_at \
                     FROM agent_provider_profile WHERE id = ?1",
                    params![id],
                    |row| {
                        Ok(AgentProviderProfile {
                            id: row.get(0)?,
                            name: row.get(1)?,
                            base_url: row.get(2)?,
                            api_key_ref: row.get(3)?,
                            test_model: row.get(4)?,
                            is_default: row.get(5)?,
                            is_enabled: row.get(6)?,
                            is_archived: row.get(7)?,
                            archived_at: row.get(8)?,
                            created_at: row.get(9)?,
                        })
                    },
                )?;
                Ok(stored)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn archive_provider(&self, id: i64) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                with_savepoint(conn, |conn| {
                    let updated = conn.execute(
                        "UPDATE agent_provider_profile
                         SET is_archived = 1, is_default = 0,
                             archived_at = COALESCE(archived_at, datetime('now'))
                         WHERE id = ?1",
                        params![id],
                    )?;
                    if updated == 0 {
                        return Err(AppError::NotFound(format!(
                            "Provider not found: {id}"
                        )));
                    }
                    conn.execute(
                        "UPDATE agent_model_profile
                         SET archived_by_provider = CASE
                                 WHEN is_archived = 0 THEN 1
                                 ELSE archived_by_provider
                             END,
                             is_archived = 1,
                             is_default = 0,
                             archived_at = COALESCE(archived_at, datetime('now'))
                         WHERE provider_profile_id = ?1",
                        params![id],
                    )?;
                    Ok(())
                })
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn unarchive_provider(&self, id: i64) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                with_savepoint(conn, |conn| {
                    let exists: bool = conn.query_row(
                        "SELECT EXISTS(
                            SELECT 1 FROM agent_provider_profile WHERE id = ?1
                        )",
                        params![id],
                        |row| row.get(0),
                    )?;
                    if !exists {
                        return Err(AppError::NotFound(format!(
                            "Provider not found: {id}"
                        )));
                    }

                    conn.execute(
                        "UPDATE agent_provider_profile
                         SET is_archived = 0, archived_at = NULL
                         WHERE id = ?1",
                        params![id],
                    )?;
                    conn.execute(
                        "UPDATE agent_model_profile
                         SET is_archived = 0,
                             archived_at = NULL,
                             archived_by_provider = 0
                         WHERE provider_profile_id = ?1
                           AND archived_by_provider = 1",
                        params![id],
                    )?;
                    Ok(())
                })
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    // --- Models ---

    async fn load_models(
        &self,
        provider_profile_id: i64,
        include_archived: bool,
    ) -> Result<Vec<AgentModelProfile>, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let sql = if include_archived {
                    "SELECT id, provider_profile_id, model_name, temperature, top_p, \
                     max_tokens, is_streaming, supports_summary, supports_translation, \
                     supports_tagging, is_default, is_enabled, is_archived, archived_at, \
                     last_tested_at, created_at \
                     FROM agent_model_profile \
                     WHERE provider_profile_id = ?1 \
                     ORDER BY model_name COLLATE NOCASE"
                } else {
                    "SELECT id, provider_profile_id, model_name, temperature, top_p, \
                     max_tokens, is_streaming, supports_summary, supports_translation, \
                     supports_tagging, is_default, is_enabled, is_archived, archived_at, \
                     last_tested_at, created_at \
                     FROM agent_model_profile \
                     WHERE provider_profile_id = ?1 AND is_archived = 0 \
                     ORDER BY model_name COLLATE NOCASE"
                };
                let mut stmt = conn.prepare(sql)?;
                let models = stmt
                    .query_map(params![provider_profile_id], |row| {
                        Ok(AgentModelProfile {
                            id: row.get(0)?,
                            provider_profile_id: row.get(1)?,
                            model_name: row.get(2)?,
                            temperature: row.get(3)?,
                            top_p: row.get(4)?,
                            max_tokens: row.get(5)?,
                            is_streaming: row.get(6)?,
                            supports_summary: row.get(7)?,
                            supports_translation: row.get(8)?,
                            supports_tagging: row.get(9)?,
                            is_default: row.get(10)?,
                            is_enabled: row.get(11)?,
                            is_archived: row.get(12)?,
                            archived_at: row.get(13)?,
                            last_tested_at: row.get(14)?,
                            created_at: row.get(15)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(models)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn upsert_model(
        &self,
        model: &AgentModelProfile,
    ) -> Result<AgentModelProfile, AppError> {
        let m = model.clone();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                if m.id != 0 {
                    let updated = conn.execute(
                        "UPDATE agent_model_profile SET \
                            model_name = ?2, temperature = ?3, top_p = ?4, max_tokens = ?5, \
                            is_streaming = ?6, supports_summary = ?7, supports_translation = ?8, \
                            supports_tagging = ?9, is_default = ?10, is_enabled = ?11, is_archived = ?12 \
                         WHERE id = ?1",
                        params![
                            m.id, m.model_name, m.temperature, m.top_p, m.max_tokens,
                            m.is_streaming, m.supports_summary, m.supports_translation,
                            m.supports_tagging, m.is_default, m.is_enabled, m.is_archived,
                        ],
                    )?;
                    if updated == 0 {
                        return Err(AppError::NotFound(format!(
                            "Model not found: {}",
                            m.id
                        )));
                    }
                } else {
                    conn.execute(
                        "INSERT INTO agent_model_profile \
                         (provider_profile_id, model_name, temperature, top_p, max_tokens, \
                          is_streaming, supports_summary, supports_translation, supports_tagging, \
                          is_default, is_enabled, is_archived) \
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                        params![
                            m.provider_profile_id, m.model_name, m.temperature, m.top_p, m.max_tokens,
                            m.is_streaming, m.supports_summary, m.supports_translation,
                            m.supports_tagging, m.is_default, m.is_enabled, m.is_archived,
                        ],
                    )?;
                }
                let id = if m.id != 0 { m.id } else { conn.last_insert_rowid() };
                if m.is_default {
                    conn.execute(
                        "UPDATE agent_model_profile SET is_default = (id = ?1) \
                         WHERE provider_profile_id = ?2",
                        params![id, m.provider_profile_id],
                    )?;
                }
                let stored = conn.query_row(
                    "SELECT id, provider_profile_id, model_name, temperature, top_p, \
                     max_tokens, is_streaming, supports_summary, supports_translation, \
                     supports_tagging, is_default, is_enabled, is_archived, archived_at, \
                     last_tested_at, created_at FROM agent_model_profile WHERE id = ?1",
                    params![id],
                    |row| {
                        Ok(AgentModelProfile {
                            id: row.get(0)?,
                            provider_profile_id: row.get(1)?,
                            model_name: row.get(2)?,
                            temperature: row.get(3)?,
                            top_p: row.get(4)?,
                            max_tokens: row.get(5)?,
                            is_streaming: row.get(6)?,
                            supports_summary: row.get(7)?,
                            supports_translation: row.get(8)?,
                            supports_tagging: row.get(9)?,
                            is_default: row.get(10)?,
                            is_enabled: row.get(11)?,
                            is_archived: row.get(12)?,
                            archived_at: row.get(13)?,
                            last_tested_at: row.get(14)?,
                            created_at: row.get(15)?,
                        })
                    },
                )?;
                Ok(stored)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn archive_model(&self, id: i64) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                let updated = conn.execute(
                    "UPDATE agent_model_profile
                     SET is_archived = 1,
                         is_default = 0,
                         archived_by_provider = 0,
                         archived_at = COALESCE(archived_at, datetime('now'))
                     WHERE id = ?1",
                    params![id],
                )?;
                if updated == 0 {
                    return Err(AppError::NotFound(format!("Model not found: {id}")));
                }
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    // --- Agent Profiles (routing) ---

    async fn load_profiles(&self) -> Result<Vec<AgentProfile>, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT agent_type, primary_model_profile_id, fallback_model_profile_id \
                     FROM agent_profile ORDER BY agent_type",
                )?;
                let profiles = stmt
                    .query_map([], |row| {
                        Ok(AgentProfile {
                            agent_type: row.get(0)?,
                            primary_model_profile_id: row.get(1)?,
                            fallback_model_profile_id: row.get(2)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(profiles)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn upsert_profile(
        &self,
        profile: &AgentProfile,
    ) -> Result<AgentProfile, AppError> {
        let p = profile.clone();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "INSERT INTO agent_profile \
                     (agent_type, primary_model_profile_id, fallback_model_profile_id) \
                     VALUES (?1, ?2, ?3) \
                     ON CONFLICT(agent_type) DO UPDATE SET \
                        primary_model_profile_id = excluded.primary_model_profile_id, \
                        fallback_model_profile_id = excluded.fallback_model_profile_id",
                    params![
                        p.agent_type,
                        p.primary_model_profile_id,
                        p.fallback_model_profile_id,
                    ],
                )?;
                Ok(p)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn set_default(&self, id: i64) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                let provider_exists: bool = conn.query_row(
                    "SELECT EXISTS(
                        SELECT 1 FROM agent_provider_profile
                        WHERE id = ?1 AND is_archived = 0
                    )",
                    params![id],
                    |row| row.get(0),
                )?;
                if provider_exists {
                    conn.execute(
                        "UPDATE agent_provider_profile
                         SET is_default = (id = ?1)
                         WHERE is_archived = 0",
                        params![id],
                    )?;
                    return Ok(());
                }

                let provider_profile_id = conn
                    .query_row(
                        "SELECT provider_profile_id
                         FROM agent_model_profile
                         WHERE id = ?1 AND is_archived = 0",
                        params![id],
                        |row| row.get::<_, i64>(0),
                    )
                    .optional()?
                    .ok_or_else(|| {
                        AppError::NotFound(format!("Provider or model not found: {id}"))
                    })?;
                conn.execute(
                    "UPDATE agent_model_profile
                     SET is_default = (id = ?1)
                     WHERE provider_profile_id = ?2 AND is_archived = 0",
                    params![id, provider_profile_id],
                )?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }
}

fn with_savepoint<T>(
    conn: &Connection,
    operation: impl FnOnce(&Connection) -> Result<T, AppError>,
) -> Result<T, AppError> {
    conn.execute_batch("SAVEPOINT oasis_agent_config")?;
    match operation(conn) {
        Ok(value) => {
            conn.execute_batch("RELEASE SAVEPOINT oasis_agent_config")?;
            Ok(value)
        }
        Err(error) => {
            let _ = conn.execute_batch(
                "ROLLBACK TO SAVEPOINT oasis_agent_config;
                 RELEASE SAVEPOINT oasis_agent_config",
            );
            Err(error)
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::{AgentConfigStore, SqliteAgentConfigStore};
    use crate::db::manager::DatabaseManager;
    use crate::db::models::{AgentModelProfile, AgentProviderProfile};

    #[tokio::test]
    async fn unarchive_preserves_provider_and_model_configuration() {
        let path = std::env::temp_dir().join(format!(
            "oasis-agent-config-{}.db",
            uuid::Uuid::new_v4()
        ));

        {
            let db = Arc::new(DatabaseManager::new(&path).unwrap());
            let store = SqliteAgentConfigStore::new(db);
            let provider = store
                .upsert_provider(&AgentProviderProfile {
                    id: 0,
                    name: "Local".to_string(),
                    base_url: "http://localhost:11434/v1".to_string(),
                    api_key_ref: "local".to_string(),
                    test_model: Some("test-model".to_string()),
                    is_default: true,
                    is_enabled: true,
                    is_archived: false,
                    archived_at: None,
                    created_at: String::new(),
                })
                .await
                .unwrap();
            assert!(!provider.created_at.is_empty());

            let model = store
                .upsert_model(&AgentModelProfile {
                    id: 0,
                    provider_profile_id: provider.id,
                    model_name: "test-model".to_string(),
                    temperature: Some(0.4),
                    top_p: Some(0.9),
                    max_tokens: Some(1024),
                    is_streaming: true,
                    supports_summary: true,
                    supports_translation: true,
                    supports_tagging: false,
                    is_default: true,
                    is_enabled: true,
                    is_archived: false,
                    archived_at: None,
                    last_tested_at: None,
                    created_at: String::new(),
                })
                .await
                .unwrap();
            assert!(!model.created_at.is_empty());

            let manually_archived_model = store
                .upsert_model(&AgentModelProfile {
                    id: 0,
                    provider_profile_id: provider.id,
                    model_name: "manual-archive".to_string(),
                    temperature: None,
                    top_p: None,
                    max_tokens: None,
                    is_streaming: true,
                    supports_summary: true,
                    supports_translation: true,
                    supports_tagging: true,
                    is_default: false,
                    is_enabled: true,
                    is_archived: true,
                    archived_at: None,
                    last_tested_at: None,
                    created_at: String::new(),
                })
                .await
                .unwrap();

            store.archive_provider(provider.id).await.unwrap();
            assert!(store.load_providers(false).await.unwrap().is_empty());
            assert!(
                store
                    .load_models(provider.id, false)
                    .await
                    .unwrap()
                    .is_empty()
            );

            store.unarchive_provider(provider.id).await.unwrap();
            let restored = store.load_providers(false).await.unwrap();
            assert_eq!(restored[0].name, "Local");
            assert_eq!(restored[0].base_url, "http://localhost:11434/v1");
            assert_eq!(restored[0].api_key_ref, "local");
            let restored_models = store.load_models(provider.id, false).await.unwrap();
            assert_eq!(restored_models[0].model_name, "test-model");
            assert_eq!(restored_models[0].temperature, Some(0.4));
            assert!(
                store
                    .load_models(provider.id, true)
                    .await
                    .unwrap()
                    .iter()
                    .find(|candidate| candidate.id == manually_archived_model.id)
                    .is_some_and(|candidate| candidate.is_archived)
            );
        }

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(path.with_extension("db-shm"));
        let _ = std::fs::remove_file(path.with_extension("db-wal"));
    }
}

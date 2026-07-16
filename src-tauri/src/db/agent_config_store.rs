use std::sync::Arc;

use async_trait::async_trait;
use rusqlite::params;

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
                conn.execute(
                    "INSERT INTO agent_provider_profile \
                     (name, base_url, api_key_ref, test_model, is_default, is_enabled, is_archived) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) \
                     ON CONFLICT(name) DO UPDATE SET \
                        base_url = excluded.base_url, \
                        api_key_ref = excluded.api_key_ref, \
                        test_model = excluded.test_model, \
                        is_default = excluded.is_default, \
                        is_enabled = excluded.is_enabled, \
                        is_archived = excluded.is_archived",
                    params![
                        p.name,
                        p.base_url,
                        p.api_key_ref,
                        p.test_model,
                        p.is_default,
                        p.is_enabled,
                        p.is_archived,
                    ],
                )?;
                let id = conn.last_insert_rowid();
                Ok(AgentProviderProfile { id, ..p })
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn archive_provider(&self, id: i64) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "UPDATE agent_provider_profile SET is_archived = 1, \
                     archived_at = datetime('now') WHERE id = ?1",
                    params![id],
                )?;
                // Also archive associated models
                conn.execute(
                    "UPDATE agent_model_profile SET is_archived = 1, \
                     archived_at = datetime('now') WHERE provider_profile_id = ?1",
                    params![id],
                )?;
                Ok(())
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
                conn.execute(
                    "INSERT INTO agent_model_profile \
                     (provider_profile_id, model_name, temperature, top_p, max_tokens, \
                      is_streaming, supports_summary, supports_translation, supports_tagging, \
                      is_default, is_enabled, is_archived) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12) \
                     ON CONFLICT(provider_profile_id, model_name) DO UPDATE SET \
                        temperature = excluded.temperature, \
                        top_p = excluded.top_p, \
                        max_tokens = excluded.max_tokens, \
                        is_streaming = excluded.is_streaming, \
                        supports_summary = excluded.supports_summary, \
                        supports_translation = excluded.supports_translation, \
                        supports_tagging = excluded.supports_tagging, \
                        is_default = excluded.is_default, \
                        is_enabled = excluded.is_enabled, \
                        is_archived = excluded.is_archived",
                    params![
                        m.provider_profile_id,
                        m.model_name,
                        m.temperature,
                        m.top_p,
                        m.max_tokens,
                        m.is_streaming,
                        m.supports_summary,
                        m.supports_translation,
                        m.supports_tagging,
                        m.is_default,
                        m.is_enabled,
                        m.is_archived,
                    ],
                )?;
                let id = conn.last_insert_rowid();
                Ok(AgentModelProfile { id, ..m })
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn archive_model(&self, id: i64) -> Result<(), AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "UPDATE agent_model_profile SET is_archived = 1, \
                     archived_at = datetime('now') WHERE id = ?1",
                    params![id],
                )?;
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
                // Try as provider first; if affected, clear other provider defaults
                let n = conn.execute(
                    "UPDATE agent_provider_profile SET is_default = (CASE WHEN id = ?1 THEN 1 ELSE 0 END)",
                    params![id],
                )?;
                if n == 0 {
                    // Not a provider; try as model — clear defaults within the same provider scope
                    conn.execute(
                        "UPDATE agent_model_profile SET is_default = (CASE WHEN id = ?1 THEN 1 ELSE 0 END) \
                         WHERE provider_profile_id = (SELECT provider_profile_id FROM agent_model_profile WHERE id = ?1)",
                        params![id],
                    )?;
                }
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }
}

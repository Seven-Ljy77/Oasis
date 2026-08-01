use std::sync::Arc;

use async_trait::async_trait;
use rusqlite::params;

use crate::db::manager::DatabaseManager;
use crate::db::models::AgentTaskRun;
use crate::error::AppError;

/// Persistence operations for agent task run records.
#[async_trait]
pub trait AgentTaskStore: Send + Sync {
    /// Persist a new task run record. Returns the record with its assigned id.
    async fn record_run(&self, run: &AgentTaskRun) -> Result<AgentTaskRun, AppError>;

    /// Update the status (and optionally the duration / error_message) of an
    /// existing task run.
    async fn update_run_status(&self, run: &AgentTaskRun) -> Result<(), AppError>;

    /// Load all task runs associated with a particular entry.
    async fn load_by_entry(&self, entry_id: i64) -> Result<Vec<AgentTaskRun>, AppError>;

    /// Load the most recent `limit` task runs across all entries.
    async fn load_recent(&self, limit: u32) -> Result<Vec<AgentTaskRun>, AppError>;
}

// =============================================================================
// SQLite Implementation
// =============================================================================

pub struct SqliteAgentTaskStore {
    db: Arc<DatabaseManager>,
}

impl SqliteAgentTaskStore {
    pub fn new(db: Arc<DatabaseManager>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl AgentTaskStore for SqliteAgentTaskStore {
    async fn record_run(&self, run: &AgentTaskRun) -> Result<AgentTaskRun, AppError> {
        let r = run.clone();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "INSERT INTO agent_task_run \
                     (entry_id, task_type, status, request_source, duration_ms, \
                      prompt_version, template_id, route_model_name, route_provider_name, \
                      error_message, created_at, updated_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, \
                             datetime('now'), datetime('now'))",
                    params![
                        r.entry_id,
                        r.task_type,
                        r.status,
                        r.request_source,
                        r.duration_ms,
                        r.prompt_version,
                        r.template_id,
                        r.route_model_name,
                        r.route_provider_name,
                        r.error_message,
                    ],
                )?;
                let id = conn.last_insert_rowid();
                let mut result = r;
                result.id = id;
                Ok(result)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn update_run_status(&self, run: &AgentTaskRun) -> Result<(), AppError> {
        let r = run.clone();
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.write(|conn| {
                conn.execute(
                    "UPDATE agent_task_run SET \
                        status = ?2, duration_ms = ?3, error_message = ?4, \
                        updated_at = datetime('now') \
                     WHERE id = ?1",
                    params![r.id, r.status, r.duration_ms, r.error_message],
                )?;
                Ok(())
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn load_by_entry(&self, entry_id: i64) -> Result<Vec<AgentTaskRun>, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT id, entry_id, task_type, status, request_source, duration_ms, \
                     prompt_version, template_id, route_model_name, route_provider_name, \
                     error_message, created_at, updated_at \
                     FROM agent_task_run \
                     WHERE entry_id = ?1 \
                     ORDER BY created_at DESC",
                )?;
                let runs = stmt
                    .query_map(params![entry_id], |row| {
                        Ok(AgentTaskRun {
                            id: row.get(0)?,
                            entry_id: row.get(1)?,
                            task_type: row.get(2)?,
                            status: row.get(3)?,
                            request_source: row.get(4)?,
                            duration_ms: row.get(5)?,
                            prompt_version: row.get(6)?,
                            template_id: row.get(7)?,
                            route_model_name: row.get(8)?,
                            route_provider_name: row.get(9)?,
                            error_message: row.get(10)?,
                            created_at: row.get(11)?,
                            updated_at: row.get(12)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(runs)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }

    async fn load_recent(&self, limit: u32) -> Result<Vec<AgentTaskRun>, AppError> {
        let db = self.db.clone();
        tokio::task::spawn_blocking(move || {
            db.read(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT id, entry_id, task_type, status, request_source, duration_ms, \
                     prompt_version, template_id, route_model_name, route_provider_name, \
                     error_message, created_at, updated_at \
                     FROM agent_task_run \
                     ORDER BY created_at DESC \
                     LIMIT ?1",
                )?;
                let runs = stmt
                    .query_map(params![limit], |row| {
                        Ok(AgentTaskRun {
                            id: row.get(0)?,
                            entry_id: row.get(1)?,
                            task_type: row.get(2)?,
                            status: row.get(3)?,
                            request_source: row.get(4)?,
                            duration_ms: row.get(5)?,
                            prompt_version: row.get(6)?,
                            template_id: row.get(7)?,
                            route_model_name: row.get(8)?,
                            route_provider_name: row.get(9)?,
                            error_message: row.get(10)?,
                            created_at: row.get(11)?,
                            updated_at: row.get(12)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(runs)
            })
        })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    }
}

use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

use crate::db::migrations::MigrationRunner;
use crate::error::AppError;

/// Manages the SQLite database connection and lifecycle.
/// Wraps rusqlite::Connection in a Mutex for thread-safe access.
pub struct DatabaseManager {
    conn: Mutex<Connection>,
}

impl DatabaseManager {
    /// Open (or create) the database at `path`, configure WAL mode and
    /// foreign keys, then run pending migrations.
    pub fn new(path: &Path) -> Result<Self, AppError> {
        let conn = Connection::open(path)?;

        // Enable WAL mode for better concurrent read performance.
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;

        // Enforce foreign key constraints.
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;

        let manager = Self { conn: Mutex::new(conn) };

        // Apply schema migrations.
        manager.run_migrations()?;

        Ok(manager)
    }

    /// Execute all pending schema migrations.
    pub fn run_migrations(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        MigrationRunner::run(&conn)
    }

    /// Execute a read-only operation on the connection.
    pub fn read<T>(&self, f: impl FnOnce(&Connection) -> Result<T, AppError>) -> Result<T, AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        f(&conn)
    }

    /// Execute a read-write operation on the connection.
    pub fn write<T>(&self, f: impl FnOnce(&Connection) -> Result<T, AppError>) -> Result<T, AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        f(&conn)
    }

    /// Access the underlying connection directly (for migration use).
    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().expect("Database mutex poisoned")
    }
}

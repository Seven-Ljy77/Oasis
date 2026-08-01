// =============================================================================
// Mercury — Logger
//
// Appends JSON log entries to logs/app.log. Thread-safe via Mutex.
// Log directory is under the OS data-local dir (created on first write),
// e.g. ~/.local/share/Oasis/logs on Linux, %LOCALAPPDATA%/Oasis/logs on Windows.
// =============================================================================

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use chrono::Utc;
use serde::Serialize;

use crate::error::AppError;

// ---------------------------------------------------------------------------
// Log entry model
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
pub struct LogEntry {
    pub timestamp: String, // ISO 8601
    pub level: String,     // "INFO" | "WARN" | "ERROR"
    pub event: String,     // e.g. "app_startup", "feed_sync"
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub extra: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

pub struct Logger {
    log_path: PathBuf,
    writer: Mutex<()>,
}

impl Logger {
    /// Create a new logger. The log file path is derived from the app data dir.
    pub fn new(data_dir: &std::path::Path) -> Self {
        let log_dir = data_dir.join("logs");
        let log_path = log_dir.join("app.log");
        Self {
            log_path,
            writer: Mutex::new(()),
        }
    }

    /// Append a single log entry (JSON line) to the log file.
    fn append(&self, entry: &LogEntry) -> Result<(), AppError> {
        let _guard = self
            .writer
            .lock()
            .map_err(|e| AppError::Logging(format!("Logger mutex poisoned: {}", e)))?;

        // Ensure log directory exists
        if let Some(parent) = self.log_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| AppError::Logging(format!("Failed to create log dir: {}", e)))?;
        }

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)
            .map_err(|e| AppError::Logging(format!("Failed to open log file: {}", e)))?;

        let line = serde_json::to_string(entry)
            .map_err(|e| AppError::Logging(format!("Failed to serialize log entry: {}", e)))?;

        writeln!(file, "{}", line)
            .map_err(|e| AppError::Logging(format!("Failed to write log entry: {}", e)))?;

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Convenience helpers
    // -----------------------------------------------------------------------

    pub fn info(&self, event: &str, message: &str) -> Result<(), AppError> {
        self.append(&LogEntry {
            timestamp: Utc::now().to_rfc3339(),
            level: "INFO".to_string(),
            event: event.to_string(),
            message: message.to_string(),
            extra: None,
        })
    }

    pub fn warn(&self, event: &str, message: &str) -> Result<(), AppError> {
        self.append(&LogEntry {
            timestamp: Utc::now().to_rfc3339(),
            level: "WARN".to_string(),
            event: event.to_string(),
            message: message.to_string(),
            extra: None,
        })
    }

    pub fn error(&self, event: &str, message: &str) -> Result<(), AppError> {
        self.append(&LogEntry {
            timestamp: Utc::now().to_rfc3339(),
            level: "ERROR".to_string(),
            event: event.to_string(),
            message: message.to_string(),
            extra: None,
        })
    }

    pub fn error_extra(
        &self,
        event: &str,
        message: &str,
        extra: serde_json::Value,
    ) -> Result<(), AppError> {
        self.append(&LogEntry {
            timestamp: Utc::now().to_rfc3339(),
            level: "ERROR".to_string(),
            event: event.to_string(),
            message: message.to_string(),
            extra: Some(extra),
        })
    }

    // -----------------------------------------------------------------------
    // Read helpers (used by upload command)
    // -----------------------------------------------------------------------

    /// Read all log entries from the file. Returns an empty Vec if the file
    /// does not exist yet.
    pub fn read_all(&self) -> Result<Vec<LogEntry>, AppError> {
        if !self.log_path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&self.log_path)
            .map_err(|e| AppError::Logging(format!("Failed to read log file: {}", e)))?;

        let entries: Vec<LogEntry> = content
            .lines()
            .filter(|line| !line.trim().is_empty())
            .filter_map(|line| serde_json::from_str::<LogEntry>(line).ok())
            .collect();

        Ok(entries)
    }

    /// Delete the log file.
    pub fn clear(&self) -> Result<(), AppError> {
        if self.log_path.exists() {
            fs::remove_file(&self.log_path)
                .map_err(|e| AppError::Logging(format!("Failed to delete log file: {}", e)))?;
        }
        Ok(())
    }
}

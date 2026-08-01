// =============================================================================
// Mercury — Log commands
//
// Tauri IPC commands for the logging / upload feature.
// =============================================================================

use serde::Serialize;
use tauri::State;

use crate::error::AppError;
use crate::logging::logger::LogEntry;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct UploadLogsResponse {
    pub uploaded: usize,
    pub status: String,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Returns all log entries read from the local log file.
#[tauri::command]
pub async fn get_logs(state: State<'_, AppState>) -> Result<Vec<LogEntry>, AppError> {
    let logger = state.logger.as_ref().ok_or_else(|| {
        AppError::Logging("Logger not initialized".to_string())
    })?;
    logger.read_all()
}

/// Simulates uploading the local log file to a server.
/// Reads the log file, counts the entries, and returns a success response.
/// No real network request is made — this is a course project mock.
#[tauri::command]
pub async fn upload_logs(state: State<'_, AppState>) -> Result<UploadLogsResponse, AppError> {
    let logger = state.logger.as_ref().ok_or_else(|| {
        AppError::Logging("Logger not initialized".to_string())
    })?;

    let entries = logger.read_all()?;
    let count = entries.len();

    // Log the upload as a system diagnostic event
    logger.info(
        "upload_completed",
        &format!("Log upload completed: {} entries sent (simulated)", count),
    )?;

    // Simulate network delay for realism
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    Ok(UploadLogsResponse {
        uploaded: count,
        status: "ok".to_string(),
    })
}

/// Deletes the local log file and records a fresh startup entry.
#[tauri::command]
pub async fn clear_logs(state: State<'_, AppState>) -> Result<(), AppError> {
    let logger = state.logger.as_ref().ok_or_else(|| {
        AppError::Logging("Logger not initialized".to_string())
    })?;
    logger.clear()?;
    logger.info("log_cleared", "All log entries cleared by user")?;
    Ok(())
}

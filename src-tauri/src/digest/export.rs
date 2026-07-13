use std::path::PathBuf;

use crate::error::AppError;

/// Export a digest (single entry) to a file with collision-safe naming.
pub fn export_digest_to_file(
    _content: &str,
    _title: &str,
    _output_dir: &PathBuf,
    _file_extension: &str,
) -> Result<PathBuf, AppError> {
    todo!()
}

/// Export multiple digests into a single file.
pub fn export_multiple_digest_to_file(
    _entries: &[(String, String)], // (title, content)
    _output_dir: &PathBuf,
    _file_extension: &str,
) -> Result<PathBuf, AppError> {
    todo!()
}

/// Generate a collision-safe filename from a title.
pub fn safe_filename(_title: &str, _extension: &str) -> String {
    todo!()
}

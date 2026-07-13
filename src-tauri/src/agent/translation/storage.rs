use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Persisted translation result record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedTranslationResult {
    pub id: i64,
    pub task_run_id: Option<i64>,
    pub entry_id: i64,
    pub target_language: String,
    pub source_content_hash: String,
    pub segmenter_version: String,
    pub run_status: String,
    pub created_at: String,
}

/// Persisted translation segment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedTranslationSegment {
    pub id: i64,
    pub translation_result_id: i64,
    pub segment_id: String,
    pub source_text: String,
    pub translated_text: String,
    pub order_index: usize,
    pub status: String,
}

/// Load the cached translation for an entry in a target language.
pub fn load_translation(
    _entry_id: i64,
    _target_language: &str,
) -> Result<Option<(SavedTranslationResult, Vec<SavedTranslationSegment>)>, AppError> {
    todo!()
}

/// Persist a translation result and its segments.
pub fn save_translation(
    _task_run_id: Option<i64>,
    _entry_id: i64,
    _target_language: &str,
    _source_content_hash: &str,
    _segmenter_version: &str,
    _segments: &[super::segment::TextSegment],
    _translations: &[String],
) -> Result<SavedTranslationResult, AppError> {
    todo!()
}

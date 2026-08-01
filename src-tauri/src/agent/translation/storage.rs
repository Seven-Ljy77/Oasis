use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::db::translation_store::TranslationStore;
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

impl From<crate::db::models::TranslationResult> for SavedTranslationResult {
    fn from(r: crate::db::models::TranslationResult) -> Self {
        Self {
            id: r.id,
            task_run_id: r.task_run_id,
            entry_id: r.entry_id,
            target_language: r.target_language,
            source_content_hash: r.source_content_hash,
            segmenter_version: r.segmenter_version,
            run_status: r.run_status,
            created_at: r.created_at,
        }
    }
}

impl From<crate::db::models::TranslationSegment> for SavedTranslationSegment {
    fn from(s: crate::db::models::TranslationSegment) -> Self {
        Self {
            id: s.id,
            translation_result_id: s.translation_result_id,
            segment_id: s.segment_id,
            source_text: s.source_text,
            translated_text: s.translated_text,
            order_index: s.order_index as usize,
            status: s.status,
        }
    }
}

/// Wrapper for translation persistence operations.
pub struct TranslationStorage {
    store: Arc<dyn TranslationStore>,
}

impl TranslationStorage {
    pub fn new(store: Arc<dyn TranslationStore>) -> Self {
        Self { store }
    }

    /// Load the cached translation for an entry in a target language.
    pub async fn load_translation(
        &self,
        entry_id: i64,
        target_language: &str,
    ) -> Result<Option<(SavedTranslationResult, Vec<SavedTranslationSegment>)>, AppError> {
        let result = self.store.load(entry_id, target_language).await?;
        Ok(result.map(|(r, s)| {
            (
                SavedTranslationResult::from(r),
                s.into_iter().map(SavedTranslationSegment::from).collect(),
            )
        }))
    }

    /// Persist a translation result and its segments.
    pub async fn save_translation(
        &self,
        task_run_id: Option<i64>,
        entry_id: i64,
        target_language: &str,
        source_content_hash: &str,
        segmenter_version: &str,
        segments: &[super::segment::TextSegment],
        translations: &[String],
    ) -> Result<SavedTranslationResult, AppError> {
        let db_segments: Vec<crate::db::models::TranslationSegment> = segments
            .iter()
            .zip(translations.iter())
            .map(|(seg, trans)| crate::db::models::TranslationSegment {
                id: 0,
                translation_result_id: 0,
                segment_id: seg.segment_id.clone(),
                source_text: seg.source_text.clone(),
                translated_text: trans.clone(),
                order_index: seg.order_index as i32,
                status: "completed".to_string(),
            })
            .collect();

        let result = crate::db::models::TranslationResult {
            id: 0,
            task_run_id,
            entry_id,
            target_language: target_language.to_string(),
            source_content_hash: source_content_hash.to_string(),
            segmenter_version: segmenter_version.to_string(),
            run_status: "in_progress".to_string(),
            created_at: String::new(),
        };

        self.store.save_checkpoint(&result, &db_segments).await?;
        Ok(SavedTranslationResult::from(result))
    }
}

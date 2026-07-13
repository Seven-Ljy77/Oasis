use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// An extracted text segment for translation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextSegment {
    pub segment_id: String,
    pub source_text: String,
    pub order_index: usize,
    pub element_path: String,
    pub content_hash: String,
}

/// Extract translatable text segments from an HTML document.
pub struct SegmentExtractor;

impl SegmentExtractor {
    pub fn new() -> Self {
        Self
    }

    /// Extract segments from cleaned HTML for translation.
    pub fn extract(_cleaned_html: &str) -> Result<Vec<TextSegment>, AppError> {
        todo!()
    }

    /// Generate a content hash for the source text to detect changes.
    pub fn content_hash(_text: &str) -> String {
        todo!()
    }
}

impl Default for SegmentExtractor {
    fn default() -> Self {
        Self::new()
    }
}

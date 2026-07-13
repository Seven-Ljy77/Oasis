use serde::{Deserialize, Serialize};

use crate::error::AppError;
use super::segment::TextSegment;

/// A bilingual segment pairing source and translated text.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BilingualSegment {
    pub segment_id: String,
    pub source_text: String,
    pub translated_text: String,
    pub order_index: usize,
}

/// Composer that builds bilingual HTML from segments.
pub struct BilingualComposer;

impl BilingualComposer {
    pub fn new() -> Self {
        Self
    }

    /// Compose bilingual output HTML by interleaving source and translated segments.
    pub fn compose(
        _source_html: &str,
        _segments: &[TextSegment],
        _translations: &[BilingualSegment],
    ) -> Result<String, AppError> {
        todo!()
    }

    /// Generate a side-by-side bilingual layout.
    pub fn compose_side_by_side(
        _segments: &[BilingualSegment],
    ) -> Result<String, AppError> {
        todo!()
    }

    /// Generate an interleaved bilingual layout (original paragraph, then translation).
    pub fn compose_interleaved(
        _segments: &[BilingualSegment],
    ) -> Result<String, AppError> {
        todo!()
    }
}

impl Default for BilingualComposer {
    fn default() -> Self {
        Self::new()
    }
}

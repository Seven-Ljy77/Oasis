use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};

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
///
/// Segments are extracted from `<p>`, `<ul>`, and `<ol>` elements — the
/// translatable paragraph-level blocks per the macOS Mercury spec. A synthetic
/// header segment (for title + author) should be provided by the caller.
pub struct SegmentExtractor;

impl SegmentExtractor {
    pub fn new() -> Self {
        Self
    }

    /// Extract segments from cleaned HTML for translation.
    /// Extracts text from `<p>`, `<li>` within `<ul>/<ol>`, and `<blockquote>` elements.
    pub fn extract(html: &str) -> Result<Vec<TextSegment>, AppError> {
        use scraper::{Html, Selector};

        let document = Html::parse_document(html);
        let mut segments = Vec::new();
        let mut order = 0usize;

        // Extract <p> elements
        if let Ok(sel) = Selector::parse("p") {
            for el in document.select(&sel) {
                let text = collect_text(&el);
                if text.is_empty() {
                    continue;
                }
                let hash = Self::content_hash(&text);
                segments.push(TextSegment {
                    segment_id: format!("p-{}", order),
                    source_text: text,
                    order_index: order,
                    element_path: "p".to_string(),
                    content_hash: hash,
                });
                order += 1;
            }
        }

        // Extract list items from <ul> and <ol>
        if let Ok(sel) = Selector::parse("li") {
            for el in document.select(&sel) {
                let text = collect_text(&el);
                if text.is_empty() {
                    continue;
                }
                let hash = Self::content_hash(&text);
                segments.push(TextSegment {
                    segment_id: format!("li-{}", order),
                    source_text: text,
                    order_index: order,
                    element_path: "li".to_string(),
                    content_hash: hash,
                });
                order += 1;
            }
        }

        // Extract blockquotes
        if let Ok(sel) = Selector::parse("blockquote") {
            for el in document.select(&sel) {
                let text = collect_text(&el);
                if text.is_empty() {
                    continue;
                }
                let hash = Self::content_hash(&text);
                segments.push(TextSegment {
                    segment_id: format!("bq-{}", order),
                    source_text: text,
                    order_index: order,
                    element_path: "blockquote".to_string(),
                    content_hash: hash,
                });
                order += 1;
            }
        }

        if segments.is_empty() {
            return Err(AppError::Reader("No translatable segments found".to_string()));
        }

        Ok(segments)
    }

    /// Generate a SHA-256 content hash for the source text to detect changes.
    pub fn content_hash(text: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(text.as_bytes());
        format!("{:x}", hasher.finalize())[..16].to_string()
    }

    /// Compute a composite hash for all segments (used to detect content changes).
    pub fn composite_hash(segments: &[TextSegment]) -> String {
        let mut hasher = Sha256::new();
        for seg in segments {
            hasher.update(seg.segment_id.as_bytes());
            hasher.update(seg.source_text.as_bytes());
        }
        format!("{:x}", hasher.finalize())[..16].to_string()
    }
}

impl Default for SegmentExtractor {
    fn default() -> Self {
        Self::new()
    }
}

/// Collect visible text from a scraper element, collapsing whitespace.
fn collect_text(el: &scraper::ElementRef<'_>) -> String {
    el.text()
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

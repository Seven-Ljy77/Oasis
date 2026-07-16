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

    /// Extract segments from cleaned HTML or plain text for translation.
    ///
    /// For HTML input, extracts text from `<p>`, `<li>` within `<ul>/<ol>`, and
    /// `<blockquote>` elements. Falls back to paragraph-splitting for plain text or
    /// Markdown input.
    pub fn extract(html: &str) -> Result<Vec<TextSegment>, AppError> {
        use scraper::{Html, Selector};

        let document = Html::parse_document(html);
        let mut segments = Vec::new();
        let mut order = 0usize;

        // Try HTML extraction first — look for common HTML structural tags.
        // If the content is plain text, these selectors will return no elements.
        let has_html_tags = Selector::parse("p").ok()
            .and_then(|s| document.select(&s).next()).is_some()
            || Selector::parse("li").ok()
            .and_then(|s| document.select(&s).next()).is_some()
            || Selector::parse("blockquote").ok()
            .and_then(|s| document.select(&s).next()).is_some();

        if has_html_tags {
            // Extract <p> elements
            if let Ok(sel) = Selector::parse("p") {
                for el in document.select(&sel) {
                    let text = collect_text(&el);
                    if text.is_empty() { continue; }
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

            // Extract list items
            if let Ok(sel) = Selector::parse("li") {
                for el in document.select(&sel) {
                    let text = collect_text(&el);
                    if text.is_empty() { continue; }
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
                    if text.is_empty() { continue; }
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
        } else {
            // Plain text / Markdown fallback: split by double newlines (paragraphs),
            // then by single newlines if only one paragraph found
            let text = collect_plain_text(html);
            if text.is_empty() {
                return Err(AppError::Reader("No translatable content found".to_string()));
            }
            let paragraphs: Vec<&str> = text.split("\n\n").filter(|p| !p.trim().is_empty()).collect();
            let splits: Vec<&str> = if paragraphs.len() <= 1 {
                text.split('\n').filter(|p| !p.trim().is_empty()).collect()
            } else {
                paragraphs
            };
            for para in splits {
                let trimmed = para.trim().to_string();
                if trimmed.len() < 3 { continue; } // skip empty/tiny fragments
                let hash = Self::content_hash(&trimmed);
                segments.push(TextSegment {
                    segment_id: format!("txt-{}", order),
                    source_text: trimmed,
                    order_index: order,
                    element_path: "text".to_string(),
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

/// Strip markdown/HTML syntax and extract plain readable text.
fn collect_plain_text(raw: &str) -> String {
    // Simple: just collapse whitespace
    raw.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

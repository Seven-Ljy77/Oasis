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
        let block_selector = Selector::parse("p, li, h1, h2, h3, h4, h5, h6")
            .map_err(|error| AppError::Reader(format!("Invalid segment selector: {error}")))?;
        let has_html_tags = document.select(&block_selector).next().is_some();

        if has_html_tags {
            // A grouped selector preserves document order across paragraphs
            // and list items, which is required for iframe segment matching.
            for el in document.select(&block_selector) {
                let text = collect_text(&el);
                // Keep this threshold in sync with the reader iframe script.
                // A one-character block is not assigned a DOM segment id.
                let visible_utf16_units: usize = text
                    .chars()
                    .filter(|character| !character.is_whitespace())
                    .map(char::len_utf16)
                    .sum();
                if visible_utf16_units < 2 {
                    continue;
                }
                let element_path = el.value().name().to_string();
                let hash = Self::content_hash(&text);
                segments.push(TextSegment {
                    segment_id: format!("{}-{}", element_path, order),
                    source_text: text,
                    order_index: order,
                    element_path,
                    content_hash: hash,
                });
                order += 1;
            }

            // Note: we intentionally skip <blockquote> as a whole segment.
            // Its inner <p>/<li> elements are already captured above, keeping
            // the order_index aligned with the reader iframe DOM numbering.
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
    let normalized_newlines = raw.replace("\r\n", "\n").replace('\r', "\n");
    let mut output = String::new();
    let mut pending_paragraph_break = false;

    for raw_line in normalized_newlines.lines() {
        let line = raw_line
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        if line.is_empty() {
            if !output.is_empty() {
                pending_paragraph_break = true;
            }
            continue;
        }

        if !output.is_empty() {
            output.push_str(if pending_paragraph_break { "\n\n" } else { "\n" });
        }
        output.push_str(&line);
        pending_paragraph_break = false;
    }

    output
}

#[cfg(test)]
mod tests {
    use super::SegmentExtractor;

    #[test]
    fn preserves_mixed_paragraph_and_list_item_order() {
        let html = "<h2>Heading</h2><p>x</p><p>\u{1f600}</p><p>First</p><ul><li>Second</li></ul><p>Third</p>";
        let segments = SegmentExtractor::extract(html).unwrap();
        let texts: Vec<&str> = segments
            .iter()
            .map(|segment| segment.source_text.as_str())
            .collect();

        assert_eq!(
            texts,
            vec!["Heading", "\u{1f600}", "First", "Second", "Third"]
        );
        assert_eq!(segments[3].order_index, 3);
        assert_eq!(segments[3].element_path, "li");
    }

    #[test]
    fn preserves_plain_text_paragraph_boundaries() {
        let text = "First   line\r\ncontinues here\r\n\r\nSecond\tparagraph\n\n\nThird paragraph";
        let segments = SegmentExtractor::extract(text).unwrap();
        let texts: Vec<&str> = segments
            .iter()
            .map(|segment| segment.source_text.as_str())
            .collect();

        assert_eq!(
            texts,
            vec!["First line\ncontinues here", "Second paragraph", "Third paragraph"]
        );
    }
}

use serde::{Deserialize, Serialize};

use crate::error::AppError;

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

    /// Compose bilingual output HTML as a full HTML document (interleaved).
    pub fn compose(
        source_html: &str,
        _segments: &[super::segment::TextSegment],
        translations: &[BilingualSegment],
    ) -> Result<String, AppError> {
        // Build a clean bilingual HTML document
        let body = Self::compose_interleaved(translations)?;

        let doc = format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body {{
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 16px;
    line-height: 1.8;
    max-width: 720px;
    margin: 0 auto;
    padding: 2rem 1rem;
    color: #1a1a1a;
    background: #faf9f7;
  }}
  .orig {{
    border-left: 3px solid #3b82f6;
    padding-left: 1rem;
    margin: 1.2em 0 0.3em 0;
    color: #1a1a1a;
  }}
  .trans {{
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 8px;
    padding: 0.8rem 1rem;
    margin: 0.5em 0 1.2em 0;
    color: #374151;
  }}
  @media (prefers-color-scheme: dark) {{
    body {{ background: #1a1a1a; color: #e8e6e3; }}
    .orig {{ color: #e8e6e3; }}
    .trans {{ color: #d1d5db; background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); }}
  }}
</style>
</head>
<body>
{body}
</body>
</html>"#
        );

        // Ignore source_html — we generate a clean bilingual view
        let _ = source_html;
        Ok(doc)
    }

    /// Generate a side-by-side bilingual layout (two-column CSS grid).
    pub fn compose_side_by_side(
        segments: &[BilingualSegment],
    ) -> Result<String, AppError> {
        let mut html = String::from(
            r#"<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem;">"#
        );

        for seg in segments {
            html.push_str(&format!(
                r#"<div class="orig" style="grid-column:1;">{}</div>"#,
                escape_html(&seg.source_text)
            ));
            html.push_str(&format!(
                r#"<div class="trans" style="grid-column:2;">{}</div>"#,
                escape_html(&seg.translated_text)
            ));
        }

        html.push_str("</div>");
        Ok(html)
    }

    /// Generate an interleaved bilingual layout (original paragraph, then translation).
    pub fn compose_interleaved(
        segments: &[BilingualSegment],
    ) -> Result<String, AppError> {
        let mut html = String::new();

        for seg in segments {
            html.push_str(&format!(
                r#"<p class="orig">{}</p>"#,
                escape_html(&seg.source_text)
            ));
            html.push_str(&format!(
                r#"<p class="trans">{}</p>"#,
                escape_html(&seg.translated_text)
            ));
        }

        Ok(html)
    }

    /// Generate a translation-only layout (no original text).
    pub fn translation_only(
        segments: &[BilingualSegment],
    ) -> Result<String, AppError> {
        let mut html = String::new();

        for seg in segments {
            html.push_str(&format!(
                r#"<p class="trans">{}</p>"#,
                escape_html(&seg.translated_text)
            ));
        }

        Ok(html)
    }
}

impl Default for BilingualComposer {
    fn default() -> Self {
        Self::new()
    }
}

/// Escape HTML special characters in text.
fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

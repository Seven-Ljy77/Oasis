use serde::{Deserialize, Serialize};

/// Reader theme tokens — CSS-able values for the reader WebView.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeTokens {
    pub font_family: String,
    pub font_size: u32,
    pub line_height: f64,
    pub max_width: u32,
    pub background_color: String,
    pub primary_text_color: String,
    pub secondary_text_color: String,
    pub link_color: String,
    pub blockquote_border_color: String,
    pub code_background_color: String,
    pub paragraph_spacing: f64,
    pub heading_scale: f64,
    pub code_border_radius: f64,
}

impl Default for ThemeTokens {
    fn default() -> Self {
        Self {
            font_family: "Georgia, serif".into(),
            font_size: 16,
            line_height: 1.8,
            max_width: 720,
            background_color: "#faf9f7".into(),
            primary_text_color: "#1a1a1a".into(),
            secondary_text_color: "#6b6b6b".into(),
            link_color: "#2563eb".into(),
            blockquote_border_color: "#2563eb".into(),
            code_background_color: "#f3f4f6".into(),
            paragraph_spacing: 1.25,
            heading_scale: 1.3,
            code_border_radius: 6.0,
        }
    }
}

/// Theme preset identifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ThemePreset {
    Classic,
    Paper,
}

/// Theme mode controls dark/light appearance.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ThemeMode {
    Auto,
    ForceLight,
    ForceDark,
}

impl ThemeTokens {
    /// Dark theme preset — swaps all colors for comfortable reading on dark backgrounds.
    pub fn dark() -> Self {
        Self {
            font_family: "Georgia, serif".into(),
            font_size: 16,
            line_height: 1.8,
            max_width: 720,
            background_color: "#1a1b1e".into(),
            primary_text_color: "#e2e2e2".into(),
            secondary_text_color: "#9ca3af".into(),
            link_color: "#93c5fd".into(),
            blockquote_border_color: "#4b5563".into(),
            code_background_color: "#2d2d2d".into(),
            paragraph_spacing: 1.25,
            heading_scale: 1.3,
            code_border_radius: 6.0,
        }
    }

    /// Eye-care / warm amber theme — reduced blue light.
    pub fn eyecare() -> Self {
        Self {
            font_family: "Georgia, serif".into(),
            font_size: 16,
            line_height: 1.8,
            max_width: 720,
            background_color: "#f5edd8".into(),
            primary_text_color: "#4a3728".into(),
            secondary_text_color: "#7a6a5c".into(),
            link_color: "#2563eb".into(),
            blockquote_border_color: "#b8956a".into(),
            code_background_color: "#e8dcc8".into(),
            paragraph_spacing: 1.25,
            heading_scale: 1.3,
            code_border_radius: 6.0,
        }
    }

    /// Generate CSS from theme tokens for injection into reader HTML.
    pub fn to_css(&self) -> String {
        format!(
            r#":root {{
  --reader-font-family: {};
  --reader-font-size: {}px;
  --reader-line-height: {};
  --reader-content-width: {}px;
  --reader-bg: {};
  --reader-text-primary: {};
  --reader-text-secondary: {};
  --reader-link: {};
  --reader-blockquote-border: {};
  --reader-code-bg: {};
  --reader-paragraph-spacing: {}em;
  --reader-heading-scale: {};
  --reader-code-radius: {}px;
}}"#,
            self.font_family,
            self.font_size,
            self.line_height,
            self.max_width,
            self.background_color,
            self.primary_text_color,
            self.secondary_text_color,
            self.link_color,
            self.blockquote_border_color,
            self.code_background_color,
            self.paragraph_spacing,
            self.heading_scale,
            self.code_border_radius,
        )
    }
}

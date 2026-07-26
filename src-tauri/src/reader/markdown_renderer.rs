// =============================================================================
// Mercury — Markdown-to-Reader-HTML Renderer
//
// Renders Markdown into a self-contained HTML document suitable for display
// inside a WebView, with theme CSS variables injected.
// =============================================================================

use crate::error::AppError;
use crate::reader::theme::ThemeTokens;

/// Minimal HTML-escape for attribute values (only `"` matters inside href).
fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// Render a Markdown string into a full reader HTML document themed with the
/// given `ThemeTokens`. When `base_url` is provided, a `<base href="...">` tag
/// is injected so that relative URLs (images, links) resolve correctly.
pub fn markdown_to_reader_html(
    markdown: &str,
    theme: &ThemeTokens,
    base_url: Option<&str>,
) -> Result<String, AppError> {
    // Configure comrak for GFM-flavoured Markdown.
    let mut options = comrak::ComrakOptions::default();
    options.extension.table = true;
    options.extension.strikethrough = true;
    options.extension.tasklist = true;
    options.extension.autolink = true;

    let body_html = comrak::markdown_to_html(markdown, &options);
    let theme_css = theme.to_css();

    // Build the base tag if a URL is provided.
    let base_tag = base_url
        .map(|url| format!("<base href=\"{}\">", html_escape(url)))
        .unwrap_or_default();

    // Build a self-contained HTML document.
    let document = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{base_tag}
<style>
{theme_css}

/* ---- Base styles using theme variables ---- */
*, *::before, *::after {{
  box-sizing: border-box;
}}

body {{
  margin: 0;
  padding: 2rem 1.5rem;
  font-family: var(--reader-font-family);
  font-size: var(--reader-font-size);
  line-height: var(--reader-line-height);
  color: var(--reader-text-primary);
  background: var(--reader-bg);
  max-width: var(--reader-content-width);
  margin: 0 auto;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}}

a {{
  color: var(--reader-link);
  text-decoration: underline;
  text-underline-offset: 0.15em;
}}

a:hover {{
  text-decoration: none;
}}

blockquote {{
  border-left: 3px solid var(--reader-blockquote-border);
  margin: 1.5em 0;
  padding: 0.5em 1em;
  color: var(--reader-text-secondary);
}}

code {{
  background: var(--reader-code-bg);
  padding: 0.15em 0.4em;
  border-radius: var(--reader-code-radius);
  font-size: 0.9em;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
}}

pre {{
  background: var(--reader-code-bg);
  border-radius: var(--reader-code-radius);
  padding: 1rem;
  overflow-x: auto;
  margin: 1.5em 0;
}}

pre code {{
  background: none;
  padding: 0;
  border-radius: 0;
  font-size: 0.9em;
}}

h1, h2, h3, h4, h5, h6 {{
  font-weight: 600;
  line-height: 1.3;
  margin-top: 2em;
  margin-bottom: 0.75em;
  color: var(--reader-text-primary);
}}

h1 {{ font-size: calc(var(--reader-font-size) * var(--reader-heading-scale) * var(--reader-heading-scale) * var(--reader-heading-scale)); }}
h2 {{ font-size: calc(var(--reader-font-size) * var(--reader-heading-scale) * var(--reader-heading-scale)); }}
h3 {{ font-size: calc(var(--reader-font-size) * var(--reader-heading-scale)); }}
h4 {{ font-size: var(--reader-font-size); }}
h5 {{ font-size: calc(var(--reader-font-size) * 0.9); }}
h6 {{ font-size: calc(var(--reader-font-size) * 0.8); }}

p {{
  margin: 0 0 var(--reader-paragraph-spacing) 0;
}}

img {{
  max-width: 100%;
  height: auto;
  border-radius: calc(var(--reader-code-radius) * 0.5);
}}

table {{
  border-collapse: collapse;
  width: 100%;
  margin: 1.5em 0;
}}

th, td {{
  border: 1px solid var(--reader-text-secondary);
  padding: 0.5em 0.75em;
  text-align: left;
}}

th {{
  background: var(--reader-code-bg);
  font-weight: 600;
}}

ul, ol {{
  padding-left: 1.5em;
  margin: 0 0 var(--reader-paragraph-spacing) 0;
}}

li {{
  margin-bottom: 0.25em;
}}

hr {{
  border: none;
  border-top: 1px solid var(--reader-blockquote-border);
  margin: 2em 0;
  opacity: 0.3;
}}
</style>
</head>
<body>
{body_html}
</body>
</html>"#
    );

    Ok(document)
}

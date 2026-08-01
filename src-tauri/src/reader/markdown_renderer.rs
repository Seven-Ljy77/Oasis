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

/* ---- Translation injected blocks ---- */
.oasis-trans {{
  margin-top: 0.5em;
  margin-bottom: 1.5em;
  padding-left: 0.75em;
  border-left: 3px solid #22c55e;
  color: var(--reader-text-secondary);
}}
</style>
</head>
<body>
{body_html}
<script>
(function() {{
  var idx = 0;
  document.addEventListener('click', function(e) {{
    var target = e.target;
    var link = target && target.closest ? target.closest('a[href]') : null;
    if (!link || !/^https?:$/i.test(link.protocol)) return;
    e.preventDefault();
    window.parent.postMessage({{ type: 'oasis-open-link', url: link.href }}, '*');
  }});

  // Number all block elements EXCEPT blockquote — its inner elements
  // (p, li, etc.) are numbered individually so translations nest correctly.
  // Skip elements with very little text (e.g. image-only paragraphs) so the
  // numbering matches the Rust segment extractor, which also skips them.
  document.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6').forEach(function(el) {{
    var text = (el.textContent || '').replace(/\s+/g, '').trim();
    if (text.length < 2) return; // skip images, empty elements
    el.setAttribute('data-segment-id', '' + idx);
    idx++;
  }});
  window.addEventListener('message', function(e) {{
    if (!e.data || e.data.type !== 'oasis-translation') return;
    var seg = e.data;
    var el = document.querySelector('[data-segment-id="' + seg.orderIndex + '"]');
    if (!el) return;
    var old = el.nextElementSibling;
    if (old && old.classList.contains('oasis-trans')) old.remove();
    var div = document.createElement('div');
    div.className = 'oasis-trans';
    div.textContent = seg.text;
    el.insertAdjacentElement('afterend', div);
    el.style.display = seg.showOriginal === false ? 'none' : '';
  }});

  // Bilingual toggle: only affects elements that already have a translation.
  window.addEventListener('message', function(e) {{
    if (e.data && e.data.type === 'oasis-toggle-bilingual') {{
      document.querySelectorAll('[data-segment-id]').forEach(function(el) {{
        var next = el.nextElementSibling;
        if (next && next.classList.contains('oasis-trans')) {{
          el.style.display = e.data.showOriginal ? '' : 'none';
        }}
      }});
    }}
  }});
  // Also handle clearing all translations.
  window.addEventListener('message', function(e) {{
    if (e.data && e.data.type === 'oasis-clear-translations') {{
      document.querySelectorAll('.oasis-trans').forEach(function(d) {{ d.remove(); }});
      document.querySelectorAll('[data-segment-id]').forEach(function(el) {{
        el.style.display = '';
      }});
    }}
  }});
}})();
</script>
</body>
</html>"#
    );

    Ok(document)
}

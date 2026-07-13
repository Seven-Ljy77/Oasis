// =============================================================================
// Mercury — HTML-to-Markdown Converter
//
// Converts HTML into plain Markdown by recursively walking the DOM tree via
// the scraper crate. Designed for the output of a readability pass (clean,
// well-structured article HTML).
// =============================================================================

use crate::error::AppError;
use scraper::{ElementRef, Html, Node, Selector};

/// Convert an HTML string to Markdown.
pub fn html_to_markdown(html: &str) -> Result<String, AppError> {
    let document = Html::parse_document(html);
    let mut output = String::new();

    // Walk starting from the <body> if present; otherwise from the root.
    if let Ok(body_sel) = Selector::parse("body") {
        if let Some(body) = document.select(&body_sel).next() {
            walk_children(&body, &mut output);
        }
    }

    // Trim trailing whitespace / extra newlines.
    let trimmed = output.trim().to_string();
    Ok(trimmed)
}

// ---------------------------------------------------------------------------
// Recursive walk
// ---------------------------------------------------------------------------

/// Recursively walk all child nodes (elements + text) of `parent`.
fn walk_children(parent: &ElementRef<'_>, output: &mut String) {
    // ElementRef derefs to ego_tree::NodeRef, which gives us .children().
    for child in parent.children() {
        match child.value() {
            Node::Text(text) => {
                let t = text.trim();
                if !t.is_empty() {
                    output.push_str(t);
                }
            }
            Node::Element(_) => {
                if let Some(el) = ElementRef::wrap(child) {
                    walk_element(&el, output);
                }
            }
            // Skip comments, doctypes, processing instructions, etc.
            _ => {}
        }
    }
}

/// Walk a single element node, dispatching by tag name.
fn walk_element(el: &ElementRef<'_>, output: &mut String) {
    let tag = el.value().name().to_ascii_lowercase();

    // Skip non-content elements entirely (including their children).
    if matches!(
        tag.as_str(),
        "script" | "style" | "nav" | "header" | "footer" | "aside" | "iframe" | "noscript"
    ) {
        return;
    }

    match tag.as_str() {
        // -----------------------------------------------------------------------
        // Headings
        // -----------------------------------------------------------------------
        "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => {
            let level = tag.as_bytes()[1] as usize - b'0' as usize;
            let prefix = "#".repeat(level);
            let text = collect_text(el);
            if !text.is_empty() {
                output.push_str(&format!("{} {}\n\n", prefix, text));
            }
        }

        // -----------------------------------------------------------------------
        // Blocks
        // -----------------------------------------------------------------------
        "p" => {
            let text = collect_text(el);
            if !text.is_empty() {
                output.push_str(&format!("{}\n\n", text));
            }
        }

        "blockquote" => {
            let text = collect_text(el);
            if !text.is_empty() {
                for line in text.lines() {
                    output.push_str(&format!("> {}\n", line));
                }
                output.push('\n');
            }
        }

        "pre" => {
            // Collect all text inside <pre> (includes nested <code> text).
            let code = el.text().collect::<Vec<_>>().join("");
            let code = code.trim();
            if !code.is_empty() {
                output.push_str(&format!("```\n{}\n```\n\n", code));
            }
            // Do NOT recurse into children — <pre> handles its own content.
        }

        // -----------------------------------------------------------------------
        // Inline formatting
        // -----------------------------------------------------------------------
        "strong" | "b" => {
            output.push_str("**");
            walk_children(el, output);
            output.push_str("**");
        }

        "em" | "i" => {
            output.push('*');
            walk_children(el, output);
            output.push('*');
        }

        "code" => {
            // Inline code only — <pre> blocks are handled above and do not
            // recurse, so any <code> we reach here is inline.
            let text = el.text().collect::<Vec<_>>().join("");
            let text = text.trim();
            if !text.is_empty() {
                output.push_str(&format!("`{}`", text));
            }
        }

        "a" => {
            let href = el.value().attr("href").unwrap_or("");
            output.push('[');
            walk_children(el, output);
            output.push(']');
            output.push('(');
            output.push_str(href);
            output.push(')');
        }

        "img" => {
            let alt = el.value().attr("alt").unwrap_or("");
            let src = el.value().attr("src").unwrap_or("");
            output.push_str(&format!("![{}]({})\n\n", alt, src));
        }

        "br" => {
            output.push('\n');
        }

        // -----------------------------------------------------------------------
        // Lists
        // -----------------------------------------------------------------------
        "ul" => {
            walk_children(el, output);
            output.push('\n');
        }

        "ol" => {
            walk_children(el, output);
            output.push('\n');
        }

        "li" => {
            let list_type = determine_list_type(el);
            let text = collect_text(el);
            if !text.is_empty() {
                match list_type {
                    OrderedListContext::Unordered => {
                        output.push_str(&format!("- {}\n", text));
                    }
                    OrderedListContext::Ordered { index } => {
                        output.push_str(&format!("{}. {}\n", index, text));
                    }
                }
            }
        }

        // -----------------------------------------------------------------------
        // Other / unknown elements — just recurse to extract text
        // -----------------------------------------------------------------------
        "div" | "section" | "article" | "main" | "span" | "figure" | "figcaption" => {
            walk_children(el, output);
        }

        _ => {
            // For any other element we do not explicitly handle, recurse into
            // children so we still capture text content.
            walk_children(el, output);
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Collect all descendant text from an element into a single whitespace-normalised string.
fn collect_text(el: &ElementRef<'_>) -> String {
    el.text()
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Determine the list context of a `<li>` element by walking up to its parent.
enum OrderedListContext {
    Unordered,
    Ordered { index: usize },
}

fn determine_list_type(li: &ElementRef<'_>) -> OrderedListContext {
    // Walk up through ancestors to find the enclosing <ul> or <ol>.
    let mut current = li.parent();
    while let Some(parent) = current {
        if let Some(parent_el) = ElementRef::wrap(parent) {
            let parent_tag = parent_el.value().name().to_ascii_lowercase();
            match parent_tag.as_str() {
                "ul" => return OrderedListContext::Unordered,
                "ol" => return OrderedListContext::Ordered {
                    index: count_preceding_li_siblings(li),
                },
                _ => {}
            }
        }
        current = parent.parent();
    }
    OrderedListContext::Unordered
}

/// Count how many `<li>` siblings appear before this element (1-based).
fn count_preceding_li_siblings(li: &ElementRef<'_>) -> usize {
    let mut count = 1usize;
    let mut current = li.prev_sibling();
    while let Some(sibling) = current {
        if let Some(el) = ElementRef::wrap(sibling) {
            if el.value().name().to_ascii_lowercase() == "li" {
                count += 1;
            }
        }
        current = sibling.prev_sibling();
    }
    count
}

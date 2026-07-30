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
                push_collapsed_text(output, text);
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
            let text = collect_inline_markdown(el);
            if !text.is_empty() {
                output.push_str(&format!("{} {}\n\n", prefix, text));
            }
        }

        // -----------------------------------------------------------------------
        // Blocks
        // -----------------------------------------------------------------------
        "p" => {
            let text = collect_inline_markdown(el);
            if !text.is_empty() {
                output.push_str(&format!("{}\n\n", text));
            }
        }

        "blockquote" => {
            let mut quote = String::new();
            walk_children(el, &mut quote);
            let quote = quote.trim();
            if !quote.is_empty() {
                for line in quote.lines() {
                    if line.is_empty() {
                        output.push_str(">\n");
                    } else {
                        output.push_str(&format!("> {}\n", line));
                    }
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
        "strong" | "b" | "em" | "i" | "code" | "a" | "img" | "br" => {
            walk_inline_element(el, output);
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
            let text = collect_inline_markdown(el);
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

fn collect_inline_markdown(el: &ElementRef<'_>) -> String {
    let mut output = String::new();
    walk_inline_children(el, &mut output);
    output.trim().to_string()
}

fn walk_inline_children(parent: &ElementRef<'_>, output: &mut String) {
    for child in parent.children() {
        match child.value() {
            Node::Text(text) => push_collapsed_text(output, text),
            Node::Element(_) => {
                if let Some(el) = ElementRef::wrap(child) {
                    walk_inline_element(&el, output);
                }
            }
            _ => {}
        }
    }
}

fn walk_inline_element(el: &ElementRef<'_>, output: &mut String) {
    let tag = el.value().name().to_ascii_lowercase();
    if matches!(
        tag.as_str(),
        "script" | "style" | "nav" | "header" | "footer" | "aside" | "iframe" | "noscript"
    ) {
        return;
    }

    match tag.as_str() {
        "strong" | "b" => {
            let text = collect_inline_markdown(el);
            if !text.is_empty() {
                output.push_str("**");
                output.push_str(&text);
                output.push_str("**");
            }
        }
        "em" | "i" => {
            let text = collect_inline_markdown(el);
            if !text.is_empty() {
                output.push('*');
                output.push_str(&text);
                output.push('*');
            }
        }
        "code" => {
            let text = el.text().collect::<Vec<_>>().join("");
            let text = text.trim();
            if !text.is_empty() {
                output.push_str(&format!("`{}`", text));
            }
        }
        "a" => {
            let text = collect_inline_markdown(el);
            let href = el.value().attr("href").unwrap_or("");
            if href.is_empty() {
                output.push_str(&text);
            } else {
                output.push('[');
                output.push_str(&text);
                output.push_str("](");
                output.push_str(href);
                output.push(')');
            }
        }
        "img" => {
            let alt = el.value().attr("alt").unwrap_or("");
            let src = el.value().attr("src").unwrap_or("");
            if !src.is_empty() {
                output.push_str(&format!("![{}]({})", alt, src));
            }
        }
        "br" => output.push_str("  \n"),
        _ => walk_inline_children(el, output),
    }
}

fn push_collapsed_text(output: &mut String, text: &str) {
    let starts_with_whitespace = text.chars().next().is_some_and(char::is_whitespace);
    let ends_with_whitespace = text.chars().next_back().is_some_and(char::is_whitespace);
    let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");

    if normalized.is_empty() {
        if !output.is_empty()
            && !output
                .chars()
                .next_back()
                .is_some_and(char::is_whitespace)
        {
            output.push(' ');
        }
        return;
    }

    if starts_with_whitespace
        && !output.is_empty()
        && !output
            .chars()
            .next_back()
            .is_some_and(char::is_whitespace)
    {
        output.push(' ');
    }
    output.push_str(&normalized);
    if ends_with_whitespace {
        output.push(' ');
    }
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

#[cfg(test)]
mod tests {
    use super::html_to_markdown;

    #[test]
    fn preserves_inline_markdown_inside_block_elements() {
        let html = r#"
            <article>
                <h2>Read <em>carefully</em></h2>
                <p>Hello <strong>bold</strong> and <a href="/docs">docs</a> <img src="/diagram.png" alt="diagram">.</p>
                <ul><li>Run <code>cargo test</code> first</li></ul>
                <blockquote><p>See <a href="/source">source</a>.</p></blockquote>
            </article>
        "#;

        let markdown = html_to_markdown(html).unwrap();

        assert!(markdown.contains("## Read *carefully*"));
        assert!(markdown.contains(
            "Hello **bold** and [docs](/docs) ![diagram](/diagram.png)."
        ));
        assert!(markdown.contains("- Run `cargo test` first"));
        assert!(markdown.contains("> See [source](/source)."));
    }

    #[test]
    fn preserves_spaces_around_inline_elements() {
        let markdown = html_to_markdown(
            "<p>Hello <strong>world</strong> and <a href=\"/next\">continue</a> now.</p>",
        )
        .unwrap();

        assert_eq!(
            markdown,
            "Hello **world** and [continue](/next) now."
        );
    }
}

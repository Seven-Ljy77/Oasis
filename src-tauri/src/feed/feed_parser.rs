use crate::error::AppError;

/// Parsed representation of a feed after XML processing.
#[derive(Debug, Clone)]
pub struct ParsedFeed {
    pub title: Option<String>,
    pub site_url: Option<String>,
    pub entries: Vec<ParsedEntry>,
}

/// A single parsed entry from a feed.
#[derive(Debug, Clone)]
pub struct ParsedEntry {
    pub guid: Option<String>,
    pub url: Option<String>,
    pub title: Option<String>,
    pub author: Option<String>,
    pub published_at: Option<String>,
    pub summary: Option<String>,
    pub content_html: Option<String>,
}

/// Parse an RSS/Atom/JSON Feed XML string into a ParsedFeed.
pub fn parse_feed(xml: &str) -> Result<ParsedFeed, AppError> {
    let feed = feed_rs::parser::parse(xml.as_bytes())
        .map_err(|e| AppError::Feed(format!("Failed to parse feed: {}", e)))?;

    let title = feed.title.map(|t| t.content);

    // For RSS, site_url is the channel link; for Atom, it is the first alternate link.
    let site_url = feed.links.first().map(|l| l.href.clone());

    let entries: Vec<ParsedEntry> = feed
        .entries
        .into_iter()
        .map(|e| {
            ParsedEntry {
                guid: Some(e.id),
                url: e.links.first().map(|l| l.href.clone()),
                title: e.title.map(|t| t.content),
                author: e.authors.into_iter().next().map(|a| a.name),
                published_at: e.published.or(e.updated).map(|d| d.to_rfc3339()),
                summary: e.summary.map(|s| s.content),
                content_html: e.content.into_iter().next().and_then(|c| c.body),
            }
        })
        .collect();

    Ok(ParsedFeed { title, site_url, entries })
}

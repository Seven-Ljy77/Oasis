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

/// Parse an RSS/Atom/JSON feed XML string into a ParsedFeed.
pub fn parse_feed(_xml: &str) -> Result<ParsedFeed, AppError> {
    todo!()
}
